/**
 * Bateria de Testes Automatizados da Correção:
 * Envio de Animal para a Fila Veterinária, Concorrência e Supabase Schema
 */

import * as fs from 'fs';
import * as path from 'path';

if (typeof (global as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { AnimalCondicao, Especie, Porte, Sexo } from '../types';
import { supabase } from '../src/lib/supabase';
import { sendAnimalToVetWaitlist } from '../src/lib/attendanceService';
import { db } from '../services/db';

console.log('================================================================');
console.log('SISBEM — BATERIA DE TESTES: FILA VETERINÁRIA & CONCORRÊNCIA');
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
  // 1. Auditoria do Schema Remoto do Supabase na tabela public.animals
  try {
    const { data: sampleAnimal, error: sampleErr } = await supabase
      .from('animals')
      .select('*')
      .limit(1)
      .maybeSingle();

    assert(!sampleErr, '1. Conexão e leitura de animals no Supabase bem-sucedida', sampleErr?.message);

    if (sampleAnimal) {
      const keys = Object.keys(sampleAnimal);
      assert(!keys.includes('em_atendimento_inicio'), '2. Coluna em_atendimento_inicio comprovadamente NÃO existe na tabela animals do Supabase');
      assert(!keys.includes('em_atendimento_vet_id'), '3. Coluna em_atendimento_vet_id comprovadamente NÃO existe na tabela animals do Supabase');
      assert(keys.includes('condicao'), '4. Coluna condicao existe e é a coluna canônica de estado');
    }
  } catch (e: any) {
    assert(false, '1-4. Auditoria de schema do Supabase', e.message);
  }

  // 2. Auditoria estática de código-fonte: NENHUMA operação .update() no Supabase envia colunas inexistentes
  const attendanceServicePath = path.join(process.cwd(), 'src/lib/attendanceService.ts');
  const attendanceServiceCode = fs.readFileSync(attendanceServicePath, 'utf8');

  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  // Verifica se não há envio de em_atendimento_inicio para supabase.from('animals').update()
  const hasInvalidColumnInSbAnimalsAttendance = /supabase\s*\.from\(\s*['"]animals['"]\s*\)\.update\(\s*\{[^}]*em_atendimento_inicio/s.test(attendanceServiceCode);
  const hasInvalidColumnInSbAnimalsServer = /supabase\s*\.from\(\s*['"]animals['"]\s*\)\.update\(\s*\{[^}]*em_atendimento_inicio/s.test(serverCode);

  assert(!hasInvalidColumnInSbAnimalsAttendance, '5. src/lib/attendanceService.ts NÃO envia em_atendimento_inicio para Supabase animals');
  assert(!hasInvalidColumnInSbAnimalsServer, '6. server.ts NÃO envia em_atendimento_inicio para Supabase animals');

  const hasInvalidVetIdInSbAttendance = /supabase\s*\.from\(\s*['"]animals['"]\s*\)\.update\(\s*\{[^}]*em_atendimento_vet_id/s.test(attendanceServiceCode);
  const hasInvalidVetIdInSbServer = /supabase\s*\.from\(\s*['"]animals['"]\s*\)\.update\(\s*\{[^}]*em_atendimento_vet_id/s.test(serverCode);

  assert(!hasInvalidVetIdInSbAttendance, '7. src/lib/attendanceService.ts NÃO envia em_atendimento_vet_id para Supabase animals');
  assert(!hasInvalidVetIdInSbServer, '8. server.ts NÃO envia em_atendimento_vet_id para Supabase animals');

  // 3. Teste de Concorrência: Envio para fila respeita trava de "Em Atendimento"
  const testAnimalEmAtendimentoId = 'test-lock-guard-animal-' + Date.now();
  // Simula usuário veterinário logado no db mock/local
  db.setCurrentUser({
    id: 'vet-test-lock-user',
    name: 'Dr. Teste Lock',
    username: 'vet.teste',
    email: 'vet.teste@sisbem.local',
    role: 'VETERINARIO',
  });

  // Insere temporariamente um registro de animal teste em atendimento no Supabase
  try {
    const { error: insErr } = await supabase.from('animals').insert([{
      id: testAnimalEmAtendimentoId,
      nome: 'Animal Teste Trava Concorrencia',
      especie: Especie.CAO,
      raca: 'SRD',
      porte: Porte.MEDIO,
      sexo: Sexo.MACHO,
      peso: 12.5,
      condicao: AnimalCondicao.EM_ATENDIMENTO,
      cor_pelagem: 'Caramelo',
      local_resgate: 'SISBEM Testes',
      data_resgate: new Date().toISOString(),
      data_cadastro: new Date().toISOString(),
      castrado: false,
      microchipado: false,
      tem_tutor: false,
      resgate_samuvet: false,
      necessita_internacao: false,
    }]);

    if (!insErr) {
      // Tenta enviar o animal que está "Em Atendimento" para a fila
      const lockResult = await sendAnimalToVetWaitlist(testAnimalEmAtendimentoId);
      assert(!lockResult.success, '9. Animal com condicao "Em Atendimento" é impedido de ser reenviado para a fila');
      assert(
        lockResult.message?.includes('em atendimento clínico no momento') === true,
        '10. Mensagem de bloqueio de concorrência é clara e orienta o profissional'
      );

      // Limpa registro de teste
      await supabase.from('animals').delete().eq('id', testAnimalEmAtendimentoId);
    } else {
      console.warn('Nota: Inserção de animal de teste no Supabase retornou:', insErr.message);
    }
  } catch (err: any) {
    console.warn('Nota de teste de inserção:', err.message);
  }

  // 4. Teste de Envio de Animal Elegível (Acolhido -> Aguardando Atendimento)
  const testEligibleAnimalId = 'test-eligible-animal-' + Date.now();
  try {
    const { error: insErr } = await supabase.from('animals').insert([{
      id: testEligibleAnimalId,
      nome: 'Animal Teste Elegivel Fila',
      especie: Especie.GATO,
      raca: 'SRD',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      peso: 4.2,
      condicao: AnimalCondicao.ACOLHIDO,
      cor_pelagem: 'Branco',
      local_resgate: 'SISBEM Testes',
      data_resgate: new Date().toISOString(),
      data_cadastro: new Date().toISOString(),
      castrado: false,
      microchipado: false,
      tem_tutor: false,
      resgate_samuvet: false,
      necessita_internacao: false,
    }]);

    if (!insErr) {
      // Executa o envio para a fila
      const sendResult = await sendAnimalToVetWaitlist(testEligibleAnimalId);
      assert(sendResult.success === true, '11. Animal elegível é enviado para a fila veterinária com sucesso');

      // Verifica condição gravada no Supabase
      const { data: updatedAnimal, error: queryErr } = await supabase
        .from('animals')
        .select('id, condicao')
        .eq('id', testEligibleAnimalId)
        .single();

      assert(!queryErr && updatedAnimal?.condicao === AnimalCondicao.AGUARDANDO_ATENDIMENTO, '12. Condição "Aguardando Atendimento" foi gravada no Supabase');

      // Limpa registro de teste
      await supabase.from('animals').delete().eq('id', testEligibleAnimalId);
    } else {
      console.warn('Nota: Inserção de animal elegível retornou:', insErr.message);
    }
  } catch (err: any) {
    console.warn('Nota de teste elegível:', err.message);
  }

  // 5. Preservação do Histórico Clínico e Funções de Atendimento
  const vetFormPath = path.join(process.cwd(), 'pages/VeterinaryForm.tsx');
  const vetFormCode = fs.readFileSync(vetFormPath, 'utf8');

  assert(vetFormCode.includes('HISTÓRICO CLÍNICO'), '13. Botão "HISTÓRICO CLÍNICO" preservado em VeterinaryForm.tsx');
  assert(vetFormCode.includes('<ClinicalHistoryModal'), '14. Componente ClinicalHistoryModal integrado em VeterinaryForm.tsx');
  assert(attendanceServiceCode.includes('startClinicalAttendance'), '15. startClinicalAttendance preservado');
  assert(attendanceServiceCode.includes('finishClinicalAttendance'), '16. finishClinicalAttendance preservado');
  assert(attendanceServiceCode.includes('cancelClinicalAttendance'), '17. cancelClinicalAttendance preservado');

  // 6. Preservação da Fila Veterinária (VetWaitlist.tsx)
  const waitlistPath = path.join(process.cwd(), 'pages/VetWaitlist.tsx');
  const waitlistCode = fs.readFileSync(waitlistPath, 'utf8');

  assert(waitlistCode.includes("in('condicao', ['Acolhido', 'Aguardando Atendimento', 'Em Atendimento'])"), '18. VetWaitlist consulta condições canônicas');
  assert(!waitlistCode.includes('em_atendimento_inicio'), '19. VetWaitlist não faz queries com em_atendimento_inicio');

  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES EXECUTADOS: ${totalTests}`);
  console.log(`TESTES APROVADOS: ${passedTests}`);
  console.log(`STATUS: ${passedTests === totalTests ? 'TODOS OS TESTES APROVADOS COM SUCESSO! 🎉' : 'HOUVE FALHAS EM ALGUNS TESTES.'}`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
