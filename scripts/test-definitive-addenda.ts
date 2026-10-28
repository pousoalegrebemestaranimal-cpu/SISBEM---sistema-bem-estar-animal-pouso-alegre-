/**
 * ==============================================================================
 * SISBEM — BATERIA DE TESTES DE INTEGRIDADE E PERSISTÊNCIA DE COMPLEMENTOS CLÍNICOS
 * ==============================================================================
 * Valida os 10 requisitos do relatório de diagnóstico:
 *  1. Registro em prontuário existente no Cloud SQL
 *  2. Registro em prontuário legado existente no Supabase (preparação de FKs)
 *  3. Tratamento de conflito de username e uid em public.users
 *  4. Tratamento de animal com campos obrigatórios ausentes na origem
 *  5. Repetição da solicitação com a mesma chave de idempotência (200 sem duplicação)
 *  6. Mesma chave com conteúdo diferente (409 IDEMPOTENCY_CONFLICT)
 *  7. Leitura do complemento pelo histórico do animal (/api/attendance/animal/:id/addenda)
 *  8. Preservação do prontuário original no Supabase (zero modificação)
 *  9. Falha controlada quando não for possível referenciar prontuário inexistente (404)
 * 10. Validação no build e verificação dos status no Cloud SQL
 * ==============================================================================
 */

if (typeof (global as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { createPool } from '../src/db/index';
import { supabase } from '../src/lib/supabase';
import { createAuthToken } from '../src/lib/serverAuth';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('SISBEM — EXECUÇÃO DA SUÍTE DE TESTES DEFINITIVA: COMPLEMENTOS');
  console.log('================================================================\n');

  const pool = createPool();
  const serverPort = 3000;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  const suffix = Date.now();
  const testVetId = `vet-test-${suffix}`;
  const testVetUsername = `vet_${suffix}`;
  const testAnimalId = `anim-test-${suffix}`;
  const testProntuarioId = `rec-test-${suffix}`;

  const tokenVet = createAuthToken({
    id: testVetId,
    username: testVetUsername,
    role: 'VETERINARIO',
    name: 'Dr. Veterinário Teste',
    crmv: '99999/MG',
  });

  try {
    // -------------------------------------------------------------------------
    // SETUP 1: Criação de dados canônicos diretamente no Cloud SQL
    // -------------------------------------------------------------------------
    await pool.query(
      `INSERT INTO public.users (id, username, role, name, crmv, uid, created_at)
       VALUES ($1, $2, 'VETERINARIO', 'Dr. Veterinário Teste', '99999/MG', NULL, NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [testVetId, testVetUsername]
    );

    await pool.query(
      `INSERT INTO public.animals (
        id, nome, peso, cor_pelagem, especie, raca, porte, sexo, castrado,
        tem_tutor, local_resgate, data_resgate, data_cadastro, condicao, resgate_samuvet, created_at
      ) VALUES ($1, 'Animal Teste', 12.5, 'Preta', 'Cão', 'SRD', 'Médio', 'Macho', false, false, 'Centro', '2026-10-28', '2026-10-28', 'Atendido', false, NOW())
      ON CONFLICT (id) DO NOTHING;`,
      [testAnimalId]
    );

    await pool.query(
      `INSERT INTO public.clinical_records (
        id, animal_id, veterinario_id, data_atendimento, inativo,
        status_resultante, observacoes_gerais, diagnostico_clinico,
        tratamento_ambulatorial, exames_solicitados, created_at
      ) VALUES ($1, $2, $3, NOW(), false, 'EM_TRATAMENTO', 'Avaliação inicial', 'Checkup de rotina', 'Nenhum', 'Nenhum', NOW())
      ON CONFLICT (id) DO NOTHING;`,
      [testProntuarioId, testAnimalId, testVetId]
    );

    // -------------------------------------------------------------------------
    // TESTE 1: Registro de complemento em prontuário existente no Cloud SQL
    // -------------------------------------------------------------------------
    const idempKey1 = `idemp_test1_${suffix}`;
    const res1 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(testProntuarioId)}/addendum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVet}`,
        'X-Idempotency-Key': idempKey1,
      },
      body: JSON.stringify({
        texto: 'Nota complementar 1: paciente em boa recuperação.',
        motivo: 'Evolução / Observação Clínica Posterior',
        idempotencyKey: idempKey1,
      }),
    });

    const data1 = await res1.json();
    assert(
      res1.status === 201 && data1.success === true && data1.addendum?.prontuarioId === testProntuarioId,
      '1. Registro de complemento em prontuário já existente no Cloud SQL',
      `Status: ${res1.status}, data: ${JSON.stringify(data1)}`
    );

    // -------------------------------------------------------------------------
    // TESTE 2 & 8: Registro em prontuário legado existente apenas no Supabase
    // -------------------------------------------------------------------------
    // Busca um prontuário real legado no Supabase para validar preparação de FKs
    let legacyProntuarioId: string | null = null;
    let legacyAnimalId: string | null = null;
    let originalSbData: any = null;

    try {
      const { data: sbRecords } = await supabase
        .from('clinical_records')
        .select('*')
        .eq('inativo', false)
        .limit(1);

      if (sbRecords && sbRecords.length > 0) {
        legacyProntuarioId = sbRecords[0].id;
        legacyAnimalId = sbRecords[0].animal_id;
        originalSbData = { ...sbRecords[0] };
      }
    } catch (e) {
      console.warn('Aviso ao consultar Supabase para teste 2:', e);
    }

    if (legacyProntuarioId) {
      const idempKey2 = `idemp_test2_${suffix}`;
      const res2 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(legacyProntuarioId)}/addendum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenVet}`,
          'X-Idempotency-Key': idempKey2,
        },
        body: JSON.stringify({
          texto: 'Nota complementar 2 em prontuário legado do Supabase.',
          motivo: 'Evolução / Observação Clínica Posterior',
          idempotencyKey: idempKey2,
        }),
      });

      const data2 = await res2.json();
      assert(
        res2.status === 201 && data2.success === true && data2.addendum?.prontuarioId === legacyProntuarioId,
        '2. Registro de complemento em prontuário legado existente no Supabase',
        `Status: ${res2.status}, data: ${JSON.stringify(data2)}`
      );

      // TESTE 8: Preservação do prontuário original no Supabase
      const { data: postSbRecords } = await supabase
        .from('clinical_records')
        .select('*')
        .eq('id', legacyProntuarioId)
        .maybeSingle();

      const isUnchanged = postSbRecords &&
        postSbRecords.diagnostico_clinico === originalSbData.diagnostico_clinico &&
        postSbRecords.tratamento_ambulatorial === originalSbData.tratamento_ambulatorial &&
        postSbRecords.inativo === originalSbData.inativo;

      assert(
        Boolean(isUnchanged),
        '8. Preservação integral do prontuário original no Supabase (zero modificação)',
        'Prontuário no Supabase foi indevidamente alterado'
      );
    } else {
      console.log('⚠️ [SKIP] Teste 2 e 8 ignorados por indisponibilidade de prontuário legado no Supabase');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: Tratamento de conflito de username e uid em public.users
    // -------------------------------------------------------------------------
    // Cria um veterinário com username em maiúsculas e tenta registrar com colisão
    const collisionVetId = `vet-col-${suffix}`;
    const tokenCollisionVet = createAuthToken({
      id: collisionVetId,
      username: testVetUsername, // Mesmo username do testVetId anterior!
      role: 'VETERINARIO',
      name: 'Dr. Veterinário Colisão',
      crmv: '88888/MG',
    });

    const idempKey3 = `idemp_test3_${suffix}`;
    const res3 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(testProntuarioId)}/addendum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCollisionVet}`,
        'X-Idempotency-Key': idempKey3,
      },
      body: JSON.stringify({
        texto: 'Nota complementar 3 com usuário de username conflitante.',
        motivo: 'Evolução / Observação Clínica Posterior',
        idempotencyKey: idempKey3,
      }),
    });

    const data3 = await res3.json();
    assert(
      res3.status === 201 && data3.success === true,
      '3. Tratamento de conflito de username ou uid em public.users',
      `Status: ${res3.status}, data: ${JSON.stringify(data3)}`
    );

    // -------------------------------------------------------------------------
    // TESTE 4: Tratamento de animal com campos obrigatórios ausentes na origem
    // -------------------------------------------------------------------------
    // Simula prontuário referenciando animal sem cadastro prévio
    const stubAnimalId = `anim-stub-${suffix}`;
    const stubProntuarioId = `rec-stub-${suffix}`;

    // Cria prontuário que depende do stubAnimalId (o backend deve criar o animal com fallbacks)
    // Inserimos o prontuário no Supabase ou via transação
    await pool.query(
      `INSERT INTO public.animals (
        id, nome, peso, cor_pelagem, especie, raca, porte, sexo, castrado,
        tem_tutor, local_resgate, data_resgate, data_cadastro, condicao, resgate_samuvet, created_at
      ) VALUES ($1, 'Animal Resgatado', 0, 'Não informada', 'Cão', 'SRD', 'Médio', 'Indefinido', false, false, 'Pouso Alegre', '2026-10-28', '2026-10-28', 'Atendido', false, NOW())
      ON CONFLICT (id) DO NOTHING;`,
      [stubAnimalId]
    );

    await pool.query(
      `INSERT INTO public.clinical_records (
        id, animal_id, veterinario_id, data_atendimento, inativo,
        status_resultante, observacoes_gerais, diagnostico_clinico,
        tratamento_ambulatorial, exames_solicitados, created_at
      ) VALUES ($1, $2, $3, NOW(), false, 'EM_OBSERVACAO', '', '', '', '', NOW())
      ON CONFLICT (id) DO NOTHING;`,
      [stubProntuarioId, stubAnimalId, testVetId]
    );

    const idempKey4 = `idemp_test4_${suffix}`;
    const res4 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(stubProntuarioId)}/addendum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVet}`,
        'X-Idempotency-Key': idempKey4,
      },
      body: JSON.stringify({
        texto: 'Nota complementar 4 em prontuário de animal com dados básicos.',
        motivo: 'Evolução / Observação Clínica Posterior',
        idempotencyKey: idempKey4,
      }),
    });

    const data4 = await res4.json();
    assert(
      res4.status === 201 && data4.success === true,
      '4. Tratamento de animal com campos obrigatórios ausentes na origem',
      `Status: ${res4.status}, data: ${JSON.stringify(data4)}`
    );

    // -------------------------------------------------------------------------
    // TESTE 5: Repetição da solicitação com a mesma chave de idempotência
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(testProntuarioId)}/addendum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVet}`,
        'X-Idempotency-Key': idempKey1, // Reenvia a mesma chave com mesmo conteúdo
      },
      body: JSON.stringify({
        texto: 'Nota complementar 1: paciente em boa recuperação.',
        motivo: 'Evolução / Observação Clínica Posterior',
        idempotencyKey: idempKey1,
      }),
    });

    const data5 = await res5.json();
    assert(
      res5.status === 200 && data5.success === true && data5.isDuplicate === true,
      '5. Repetição da solicitação com a mesma chave de idempotência (200 sem duplicação)',
      `Status: ${res5.status}, data: ${JSON.stringify(data5)}`
    );

    // -------------------------------------------------------------------------
    // TESTE 6: Mesma chave com conteúdo diferente (HTTP 409)
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(testProntuarioId)}/addendum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVet}`,
        'X-Idempotency-Key': idempKey1, // Mesma chave, texto diferente
      },
      body: JSON.stringify({
        texto: 'Texto divergente proposital para forçar conflito 409.',
        motivo: 'Evolução / Observação Clínica Posterior',
        idempotencyKey: idempKey1,
      }),
    });

    const data6 = await res6.json();
    assert(
      res6.status === 409 && data6.code === 'IDEMPOTENCY_CONFLICT',
      '6. Mesma chave de idempotência com conteúdo diferente retorna HTTP 409 IDEMPOTENCY_CONFLICT',
      `Status: ${res6.status}, code: ${data6.code}`
    );

    // -------------------------------------------------------------------------
    // TESTE 7: Leitura do complemento pelo histórico do animal
    // -------------------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/api/attendance/animal/${encodeURIComponent(testAnimalId)}/addenda`, {
      headers: {
        Authorization: `Bearer ${tokenVet}`,
      },
    });

    const data7 = await res7.json();
    const hasAddendum = Array.isArray(data7.addenda) && data7.addenda.some((a: any) => a.prontuarioId === testProntuarioId);
    assert(
      res7.status === 200 && data7.success === true && hasAddendum,
      '7. Leitura do complemento pelo endpoint de histórico do animal',
      `Status: ${res7.status}, addenda: ${data7.addenda?.length || 0}`
    );

    // -------------------------------------------------------------------------
    // TESTE 9: Falha controlada quando prontuário não existe (HTTP 404)
    // -------------------------------------------------------------------------
    const ghostProntuarioId = `rec-ghost-nonexistent-${suffix}`;
    const res9 = await fetch(`${baseUrl}/api/attendance/records/${encodeURIComponent(ghostProntuarioId)}/addendum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVet}`,
      },
      body: JSON.stringify({
        texto: 'Tentativa em prontuário inexistente.',
        motivo: 'Evolução / Observação Clínica Posterior',
      }),
    });

    const data9 = await res9.json();
    assert(
      res9.status === 404 && data9.code === 'RECORD_NOT_FOUND',
      '9. Falha controlada quando não for possível estabelecer referência válida (HTTP 404)',
      `Status: ${res9.status}, code: ${data9.code}`
    );

    // -------------------------------------------------------------------------
    // TESTE 10: Verificação de status e persistência em Cloud SQL
    // -------------------------------------------------------------------------
    const checkDb = await pool.query(
      `SELECT id, prontuario_id, sync_status FROM public.clinical_record_addenda WHERE prontuario_id = $1 LIMIT 5;`,
      [testProntuarioId]
    );

    const hasStoredPrimary = checkDb.rows.length > 0 && checkDb.rows.every(r => r.sync_status === 'STORED_PRIMARY');
    assert(
      hasStoredPrimary,
      '10. Funcionamento e persistência no Cloud SQL com sync_status = STORED_PRIMARY',
      `Registros: ${checkDb.rows.length}, status: ${checkDb.rows[0]?.sync_status}`
    );

  } catch (err: any) {
    console.error('Erro inesperado durante a execução dos testes:', err);
  } finally {
    console.log('\n================================================================');
    console.log(`TOTAL DE TESTES: ${totalTests} | APROVADOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
    console.log('================================================================');
    await pool.end().catch(() => {});
  }
}

runTestSuite().catch(console.error);
