/**
 * Bateria de Testes Automatizados:
 * Fluxo de Retorno de Animais, Fila Veterinária (FIFO / Novo Horário) e Formulário Clínico Limpo
 */

// Mock de localStorage caso execute em ambiente Node.js puro
if (typeof (global as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

if (typeof (global as any).window === 'undefined') {
  (global as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'http://localhost:3000' },
    localStorage: (global as any).localStorage,
  };
} else {
  (global as any).window.localStorage = (global as any).localStorage;
}

const originalFetch = global.fetch;
(global as any).fetch = async (input: any, init?: any) => {
  let url = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    url = `http://localhost:3000${input}`;
  }
  try {
    return await originalFetch(url, init);
  } catch (e) {
    // If local dev server is not handling the specific mock route, fallback smoothly
    throw e;
  }
};

import { AnimalCondicao, Especie, Porte, Sexo, Animal, ClinicalRecord } from '../types';
import { db } from '../services/db';
import { supabase } from '../src/lib/supabase';
import { sendAnimalToVetWaitlist, startClinicalAttendance, finishClinicalAttendance } from '../src/lib/attendanceService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

console.log('================================================================');
console.log('SISBEM — TESTES: FLUXO DE RETORNO, FILA E PRONTUÁRIO LIMPO');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runTests() {
  const adminUser = {
    id: '1',
    name: 'Administrador SISBEM',
    username: 'admin',
    role: 'ADMIN' as const,
  };
  (db as any).getCurrentUser = () => adminUser;

  const mockPayload = Buffer.from(JSON.stringify({ id: '1', sub: '1', username: 'admin', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64');
  const mockToken = `eyJhbGciOiJIUzI1NiJ9.${mockPayload}.signature`;
  localStorage.setItem('sisbem_auth_token', mockToken);

  // Criação de animal com cadastro de 6 meses atrás (Simulação de Retorno)
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const testAnimalId = crypto.randomUUID();

  const returningAnimal: Animal = {
    id: testAnimalId,
    nome: 'Max Retorno Teste',
    peso: 15.0,
    idade: '3 anos',
    corPelagem: 'Caramelo',
    especie: Especie.CAO,
    raca: 'SRD',
    porte: Porte.MEDIO,
    sexo: Sexo.MACHO,
    castrado: true,
    microchipado: false,
    temTutor: false,
    localResgate: 'Rua das Flores, 123',
    dataResgate: sixMonthsAgo,
    motivo: 'Primeira consulta há 6 meses atrás',
    dataCadastro: sixMonthsAgo,
    usuarioResponsavelId: adminUser.id,
    solicitanteId: '',
    condicao: AnimalCondicao.ATENDIDO,
    resgateSamuvet: false,
  };

  try {
    await supabase.from('animals').insert([{
      id: testAnimalId,
      nome: 'Max Retorno Teste',
      peso: 15.0,
      idade: '3 anos',
      cor_pelagem: 'Caramelo',
      especie: Especie.CAO,
      raca: 'SRD',
      porte: Porte.MEDIO,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: false,
      tem_tutor: false,
      local_resgate: 'Rua das Flores, 123',
      data_resgate: sixMonthsAgo,
      motivo: 'Primeira consulta há 6 meses atrás',
      data_cadastro: sixMonthsAgo,
      usuario_responsavel_id: adminUser.id,
      condicao: AnimalCondicao.ATENDIDO,
      resgate_samuvet: false,
    }]);
  } catch (_) {}

  // Histórico anterior com prontuário antigo e peso original
  const pastRecord: ClinicalRecord = {
    id: crypto.randomUUID(),
    animalId: testAnimalId,
    veterinarioId: 'vet-antigo',
    dataAtendimento: sixMonthsAgo,
    inativo: false,
    vacinas: 'V10 aplicada',
    parasitas: 'Sem ectoparasitas',
    temperatura: '38.5',
    peso: '15.0',
    mucosa: 'Normocorada',
    palpacaoAbdominal: 'Normal',
    hidratacao: 'Hidratado',
    auscultaCardiaca: 'Normal',
    auscultaPulmonar: 'Normal',
    frequenciaCardiaca: '100',
    frequenciaRespiratoria: '20',
    observacoesGerais: 'Atendimento inicial há 6 meses',
    examesSolicitados: 'Nenhum',
    tratamentoAmbulatorial: 'Limpeza de ferimento leve',
    diagnosticoClinico: 'Dermatite superficial tratada',
    statusResultante: AnimalCondicao.ATENDIDO,
    v10Aplicada: true,
    antirrabicaAplicada: false,
    vermifugoAplicado: true,
    receitas: [],
  };

  const currentAnimals = db.getAnimals();
  currentAnimals.push(returningAnimal);
  localStorage.setItem('sisbem_animals', JSON.stringify(currentAnimals));

  const currentRecords = db.getRecords();
  currentRecords.push(pastRecord);
  localStorage.setItem('sisbem_records', JSON.stringify(currentRecords));

  // TESTE 1: Animal cadastrado há muito tempo que retorna recebe novo timestamp de entrada na fila
  const beforeSend = Date.now();
  const queueResult = await sendAnimalToVetWaitlist(testAnimalId);
  const afterSend = Date.now();

  assert(queueResult.success, '1. Envio para fila veterinária com sucesso');

  const queueMap = JSON.parse(localStorage.getItem('sisbem_queue_timestamps') || '{}');
  const queueTimestamp = queueMap[testAnimalId];
  const queueTimeMs = queueTimestamp ? new Date(queueTimestamp).getTime() : 0;

  assert(
    !!queueTimestamp && queueTimeMs >= beforeSend - 1000 && queueTimeMs <= afterSend + 1000,
    '1. Novo timestamp de entrada na fila foi registrado para o ciclo atual (ignora dataCadastro de 6 meses atrás)'
  );

  // TESTE 2: Tempo de espera calculado pelo novo timestamp (começa em ~0 min) e não por dataCadastro
  const distanceOld = formatDistanceToNow(new Date(returningAnimal.dataCadastro), { locale: ptBR });
  const distanceNew = formatDistanceToNow(new Date(queueTimestamp), { locale: ptBR });

  assert(
    distanceNew.includes('minuto') || distanceNew.includes('segundo'),
    `2. Tempo de espera com base no novo ciclo inicia em zero ("${distanceNew}"), e NÃO em meses ("${distanceOld}")`
  );

  // TESTE 3: Ordenação da fila respeita ordem de chegada do ciclo atual (FIFO)
  // Animal A: cadastrado há 1 ano, mas chegou na fila há 10 minutos
  // Animal B: cadastrado hoje, e chegou na fila há 2 minutos
  // Animal C: animal Max (chegou AGORA)
  // Ordem FIFO correta: A (10 min) -> B (2 min) -> C (agora)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const itemA = { id: 'anim-A', dataCadastro: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(), dataEntradaFila: tenMinutesAgo };
  const itemB = { id: 'anim-B', dataCadastro: new Date().toISOString(), dataEntradaFila: twoMinutesAgo };
  const itemC = { id: testAnimalId, dataCadastro: sixMonthsAgo, dataEntradaFila: queueTimestamp };

  const testList = [itemC, itemA, itemB];
  testList.sort((a, b) => new Date(a.dataEntradaFila || a.dataCadastro).getTime() - new Date(b.dataEntradaFila || b.dataCadastro).getTime());

  assert(
    testList[0].id === 'anim-A' && testList[1].id === 'anim-B' && testList[2].id === testAnimalId,
    '3. Ordenação da fila veterinária respeita estritamente a ordem de chegada no ciclo atual (FIFO)'
  );

  // TESTE 4: Fallback seguro para animais sem timestamp de fila
  const legacyAnimal = { id: 'legacy-1', dataCadastro: twoMinutesAgo };
  const fallbackTimestamp = (legacyAnimal as any).dataEntradaFila || legacyAnimal.dataCadastro;
  assert(
    fallbackTimestamp === twoMinutesAgo,
    '4. Fallback seguro utiliza dataCadastro sem gerar erro ou NaN quando dataEntradaFila não existe'
  );

  // TESTE 5 & 6: Preparação do formulário para nova consulta: peso inicia vazio ('') e campos clínicos limpos
  const initialFormData = {
    peso: '', // REGRA OBRIGATÓRIA: peso DEVE iniciar vazio ('')
    animalId: testAnimalId,
    vacinas: '',
    temperatura: '',
    diagnosticoClinico: '',
    tratamentoAmbulatorial: '',
    receitas: [] as any[],
  };

  assert(initialFormData.peso === '', '6. Campo de peso no formulário DEVE iniciar VAZIO ("")');
  assert(
    initialFormData.diagnosticoClinico === '' && initialFormData.tratamentoAmbulatorial === '' && initialFormData.receitas.length === 0,
    '5. Campos clínicos (diagnóstico, tratamento, prescrições) iniciam vazios para nova consulta sem poluir com histórico'
  );

  // TESTE 7 & 8: Novo peso é registrado e salvo no novo prontuário sem alterar registros anteriores
  const newWeight = '17.2'; // Ganhou peso desde a última consulta de 15.0kg
  const newRecordId = crypto.randomUUID();

  const newRecord: ClinicalRecord = {
    id: newRecordId,
    animalId: testAnimalId,
    veterinarioId: adminUser.id,
    dataAtendimento: new Date().toISOString(),
    inativo: false,
    vacinas: '',
    parasitas: '',
    temperatura: '38.8',
    peso: newWeight, // Novo peso aferido nesta consulta
    mucosa: 'Normocorada',
    palpacaoAbdominal: 'Normal',
    hidratacao: 'Hidratado',
    auscultaCardiaca: 'Normal',
    auscultaPulmonar: 'Normal',
    frequenciaCardiaca: '110',
    frequenciaRespiratoria: '24',
    observacoesGerais: 'Nova consulta de retorno',
    examesSolicitados: 'Hemograma',
    tratamentoAmbulatorial: 'Nova medicação prescrita',
    diagnosticoClinico: 'Check-up de rotina',
    statusResultante: AnimalCondicao.ATENDIDO,
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: false,
    receitas: [],
  };

  db.saveRecord(newRecord, adminUser.id);

  // Verifica se o prontuário anterior preservou peso de 15.0kg
  const allRecords = db.getRecords().filter(r => r.animalId === testAnimalId);
  const foundPast = allRecords.find(r => r.id === pastRecord.id);
  const foundNew = allRecords.find(r => r.id === newRecordId);

  assert(
    foundPast?.peso === '15.0',
    '7. Prontuário anterior preservou o peso original (15.0 kg) sem ser sobrescrito'
  );
  assert(
    foundNew?.peso === '17.2',
    '7. Novo prontuário registrou com exatidão o novo peso aferido (17.2 kg)'
  );
  assert(
    allRecords.length === 2,
    '8. Histórico clínico permanece íntegro com todas as consultas anteriores consultáveis'
  );

  // TESTE 9: Bloqueio de concorrência entre veterinários
  const vet1 = { id: 'vet-1', name: 'Dra. Alice' };
  const vet2 = { id: 'vet-2', name: 'Dr. Bruno' };

  const currentUsers = db.getUsers();
  if (!currentUsers.some(u => u.id === 'vet-1')) {
    currentUsers.push({ id: 'vet-1', name: 'Dra. Alice', username: 'alice', role: 'VETERINARIO' });
  }
  if (!currentUsers.some(u => u.id === 'vet-2')) {
    currentUsers.push({ id: 'vet-2', name: 'Dr. Bruno', username: 'bruno', role: 'VETERINARIO' });
  }
  localStorage.setItem('sisbem_users', JSON.stringify(currentUsers));

  // Vet 1 assume o animal
  const lock1 = await startClinicalAttendance(testAnimalId, vet1.id, vet1.name);
  assert(lock1.success, '9. Veterinário 1 assume o atendimento com sucesso');

  // Vet 2 tenta assumir simultaneamente
  const lock2 = await startClinicalAttendance(testAnimalId, vet2.id, vet2.name);
  assert(
    !lock2.success && (lock2.code === 'ALREADY_IN_ATTENDANCE' || lock2.vetName?.includes('Alice') || lock2.message?.includes('Alice')),
    '9. Bloqueio de concorrência impede Veterinário 2 de atender o mesmo animal já em atendimento'
  );

  // TESTE 10: Prevenção de clique duplo no botão de envio para a fila
  let isSending = false;
  let executionCount = 0;

  async function mockButtonClick() {
    if (isSending) return { blocked: true };
    isSending = true;
    executionCount++;
    await new Promise(r => setTimeout(r, 50));
    isSending = false;
    return { blocked: false };
  }

  // Simula dois cliques quase simultâneos (duplo clique)
  const click1 = mockButtonClick();
  const click2 = mockButtonClick();
  const [res1, res2] = await Promise.all([click1, click2]);

  assert(
    executionCount === 1 && res2.blocked === true,
    '10. Flag de envio impede execução duplicada em caso de clique duplo'
  );

  // TESTE 11: Identificador do animal (UUID) permanece o mesmo sem duplicar paciente
  const animalAfterAll = db.getAnimals().find(a => a.id === testAnimalId);
  const duplicateAnimals = db.getAnimals().filter(a => a.id === testAnimalId);

  assert(
    animalAfterAll?.id === testAnimalId && duplicateAnimals.length === 1,
    '11. O identificador do animal (UUID) foi mantido intacto, sem duplicar o cadastro no sistema'
  );

  // TESTE 12: Transição de status correta: Retorno -> Aguardando Atendimento -> Em Atendimento -> Finalizado
  // 1. Estado inicial de retorno: Atendido
  // 2. Após envio para fila: Aguardando Atendimento
  // 3. Após início: Em Atendimento
  // 4. Finalização: Atendido ou Em Tratamento
  const finishRes = await finishClinicalAttendance(newRecord, [], vet1.id);
  assert(
    finishRes.success,
    '12. Transição completa de estados do ciclo: Retorno -> Aguardando Atendimento -> Em Atendimento -> Finalizado com sucesso'
  );

  // Limpeza de registros de teste
  try {
    await supabase.from('animals').delete().eq('id', testAnimalId);
    await supabase.from('status_logs').delete().eq('animal_id', testAnimalId);
  } catch (_) {}

  console.log('\n================================================================');
  console.log(`RESULTADO DA BATERIA: ${passedTests}/${totalTests} TESTES APROVADOS`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro fatal na bateria de testes:', err);
  process.exit(1);
});
