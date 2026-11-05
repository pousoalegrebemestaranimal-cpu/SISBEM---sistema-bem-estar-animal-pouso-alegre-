/**
 * Teste de Validação e Auditoria da Sincronização de Configurações Administrativas no SISBEM
 * Simula múltiplos computadores (Computador A, Computador B, Computador C) e verifica:
 * 1. Persistência centralizada no Supabase (solicitantes: system-configs-v1 e kennels)
 * 2. Atualização em tempo real do Computador B sem reinicialização
 * 3. Carregamento correto pelo Computador C na inicialização (cold start)
 * 4. Bloqueio de alteração por usuário não administrador (Controle de Permissões)
 * 5. Tratamento de concorrência e conflitos de edição (Versionamento e Timestamps)
 */

import { supabase } from '../src/lib/supabase.js';
import {
  syncKennelConfigsToSupabase,
  parseSystemConfigs,
  syncLocalKennelsWithConfigs,
  pullFromSupabaseToLocal,
  SystemConfigsPayload
} from '../src/lib/supabaseSync.js';
import { KennelConfig, KennelType, Kennel } from '../types.js';

// Setup Mock LocalStorage isolado para cada computador
class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
}

// Injeta storage global se estiver no Node
const globalStorage = new MockStorage();
(global as any).localStorage = globalStorage;
(global as any).window = {
  dispatchEvent: (event: any) => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function runAuditTests() {
  console.log('================================================================');
  console.log('INICIANDO AUDITORIA E TESTE DE CONFIGURAÇÕES COMPARTILHADAS');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Detalhes: ${details}`);
    }
  }

  // --------------------------------------------------------------------------
  // TESTE 1: Bloqueio de Usuário Sem Permissão (Não-Admin)
  // --------------------------------------------------------------------------
  console.log('--- TESTE 1: Controle de Permissões ---');
  const nonAdminUser = {
    id: 'user-vet-001',
    name: 'Dr. Roberto Veterinário',
    username: 'roberto_vet',
    role: 'VETERINARIO'
  };

  const testConfigs: KennelConfig[] = [
    { type: KennelType.INDIVIDUAL, count: 55, capacity: 2 },
    { type: KennelType.COLETIVA, count: 11, capacity: 5 },
    { type: KennelType.QUARENTENA, count: 9, capacity: 2 },
    { type: KennelType.GATIL, count: 43, capacity: 3 },
    { type: KennelType.PRE_OPERATORIO, count: 3, capacity: 1 },
    { type: KennelType.POS_OPERATORIO, count: 6, capacity: 1 }
  ];

  const unauthorizedResult = await syncKennelConfigsToSupabase(testConfigs, undefined, nonAdminUser);
  assert(
    unauthorizedResult.success === false && unauthorizedResult.error?.includes('administradores'),
    'Usuário com papel VETERINARIO não pode salvar configurações administrativas',
    JSON.stringify(unauthorizedResult)
  );

  // --------------------------------------------------------------------------
  // TESTE 2: Computador A (Admin) Altera Configuração e Salva no Banco Central
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 2: Computador A Salva Alteração Centralizada ---');
  const adminUserA = {
    id: 'user-admin-001',
    name: 'Administrador SISBEM (Comp A)',
    username: 'admin_compa',
    role: 'ADMIN'
  };

  // Consulta versão atual remota antes de alterar
  const { data: initialRemote } = await supabase
    .from('solicitantes')
    .select('observacoes')
    .eq('id', 'system-configs-v1')
    .maybeSingle();

  const currentRemoteParsed = parseSystemConfigs(initialRemote?.observacoes);
  const currentVersion = currentRemoteParsed?.version || 1;

  // Computador A altera a quantidade de baias INDIVIDUAL de 54 para 56 e capacidade para 2
  const updatedConfigsA: KennelConfig[] = [
    { type: KennelType.INDIVIDUAL, count: 56, capacity: 2 },
    { type: KennelType.COLETIVA, count: 12, capacity: 5 },
    { type: KennelType.QUARENTENA, count: 9, capacity: 2 },
    { type: KennelType.GATIL, count: 44, capacity: 3 },
    { type: KennelType.PRE_OPERATORIO, count: 4, capacity: 1 },
    { type: KennelType.POS_OPERATORIO, count: 7, capacity: 1 }
  ];

  const saveResultA = await syncKennelConfigsToSupabase(updatedConfigsA, currentVersion, adminUserA);
  assert(
    saveResultA.success === true && (saveResultA.version || 0) > currentVersion,
    `Computador A salvou com sucesso no banco central (Versão ${saveResultA.version})`,
    JSON.stringify(saveResultA)
  );

  // Confirma no banco central Supabase
  const { data: verifiedRemote } = await supabase
    .from('solicitantes')
    .select('observacoes, created_at')
    .eq('id', 'system-configs-v1')
    .single();

  const verifiedParsed = parseSystemConfigs(verifiedRemote?.observacoes);
  assert(
    verifiedParsed !== null &&
    verifiedParsed.version === saveResultA.version &&
    verifiedParsed.configs.find(c => c.type === KennelType.INDIVIDUAL)?.count === 56 &&
    verifiedParsed.configs.find(c => c.type === KennelType.INDIVIDUAL)?.capacity === 2 &&
    verifiedParsed.updatedBy?.username === 'admin_compa',
    'Registro system-configs-v1 no Supabase contém nova versão, contagem (56), capacidade (2) e autor',
    JSON.stringify(verifiedParsed)
  );

  // --------------------------------------------------------------------------
  // TESTE 3: Tratamento de Conflito Concorrente
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 3: Detecção de Conflito de Concorrência ---');
  // Outro administrador tentando salvar com uma versão defasada (currentVersion anterior)
  const adminConflictUser = {
    id: 'user-admin-002',
    name: 'Segundo Admin',
    username: 'admin2',
    role: 'ADMIN'
  };

  const conflictResult = await syncKennelConfigsToSupabase(testConfigs, currentVersion, adminConflictUser);
  assert(
    conflictResult.success === false && conflictResult.error?.includes('Conflito de concorrência'),
    'Detectado conflito concorrente quando expectedVersion for inferior à versão remota mais recente',
    JSON.stringify(conflictResult)
  );

  // --------------------------------------------------------------------------
  // TESTE 4: Computador B (Sistema Aberto) Recebe a Atualização Sem Reiniciar
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 4: Computador B (Em Execução) Sincroniza Sem Reiniciar ---');
  // Cria storage isolado do Computador B com configuração antiga (54 baias)
  const storageB = new MockStorage();
  storageB.setItem('sisbem_kennel_configs', JSON.stringify([
    { type: KennelType.INDIVIDUAL, count: 54, capacity: 1 }
  ]));
  storageB.setItem('sisbem_kennel_configs_version', '1');

  // Alterna o contexto global temporariamente para o Computador B
  (global as any).localStorage = storageB;

  const eventTracker = { dispatched: false };
  let receivedPayload: any = null;
  (global as any).window = {
    dispatchEvent: (event: any) => {
      if (event.type === 'sisbem-settings-changed') {
        eventTracker.dispatched = true;
        receivedPayload = event.detail;
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  // Simula recepção via pull ou realtime no Computador B
  await pullFromSupabaseToLocal(undefined, { modules: ['configs'], force: true });

  const compBStored = JSON.parse(storageB.getItem('sisbem_kennel_configs') || '[]');
  const compBIndividual = compBStored.find((c: any) => c.type === KennelType.INDIVIDUAL);
  const compBVersion = storageB.getItem('sisbem_kennel_configs_version');

  assert(
    compBIndividual?.count === 56 && compBIndividual?.capacity === 2 && compBVersion === String(saveResultA.version),
    'Computador B atualizou o cache local com a versão oficial do banco (count: 56, capacity: 2)',
    JSON.stringify({ compBIndividual, compBVersion })
  );

  assert(
    eventTracker.dispatched && receivedPayload?.version === saveResultA.version,
    'Computador B disparou evento reativo sisbem-settings-changed para atualizar a tela sem reload',
    JSON.stringify(receivedPayload)
  );

  // --------------------------------------------------------------------------
  // TESTE 5: Computador C Abre Mais Tarde (Cold Start)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 5: Computador C (Cold Start) Carrega Diretamente a Versão Atualizada ---');
  // Cria storage zerado ou com dados desatualizados do Computador C
  const storageC = new MockStorage();
  (global as any).localStorage = storageC;

  // Computador C inicializa e faz pull inicial
  await pullFromSupabaseToLocal(undefined, { modules: ['configs'], force: true });

  const compCStored = JSON.parse(storageC.getItem('sisbem_kennel_configs') || '[]');
  const compCIndividual = compCStored.find((c: any) => c.type === KennelType.INDIVIDUAL);
  const compCVersion = storageC.getItem('sisbem_kennel_configs_version');

  assert(
    compCIndividual?.count === 56 && compCIndividual?.capacity === 2 && compCVersion === String(saveResultA.version),
    'Computador C iniciou do zero e carregou diretamente as configurações atualizadas da nuvem',
    JSON.stringify({ compCIndividual, compCVersion })
  );

  // --------------------------------------------------------------------------
  // TESTE 6: Geração de Baias Físicas a partir das Configurações
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 6: Integridade das Baias Físicas Geradas ---');
  syncLocalKennelsWithConfigs(compCStored);
  const generatedKennels: Kennel[] = JSON.parse(storageC.getItem('sisbem_kennels') || '[]');
  const individualKennels = generatedKennels.filter(k => k.type === KennelType.INDIVIDUAL);

  assert(
    individualKennels.length === 56 && individualKennels.every(k => k.capacity === 2),
    'Inventário físico de baias no Computador C gerou exatamente 56 unidades individuais com capacidade 2',
    `Total: ${individualKennels.length}, Capacidade primeira: ${individualKennels[0]?.capacity}`
  );

  // --------------------------------------------------------------------------
  // Finalização do Teste
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RESULTADO DA AUDITORIA: ${passedTests}/${totalTests} testes aprovados.`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 TODAS AS VALIDAÇÕES DE CENTRALIZAÇÃO E SINCRONIZAÇÃO PASSARAM COM SUCESSO!\n');
    process.exit(0);
  } else {
    console.error('❌ HOUVE FALHAS NA AUDITORIA.');
    process.exit(1);
  }
}

runAuditTests().catch(err => {
  console.error('Erro fatal no teste:', err);
  process.exit(1);
});
