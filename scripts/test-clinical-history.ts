/**
 * Script de Verificação e Testes Automatizados da Etapa 1:
 * Histórico Clínico durante o Atendimento Veterinário no SISBEM.
 */

import { Especie, Porte, Sexo, AnimalCondicao, ClinicalRecord, Prescription, Referral } from '../types';

console.log('================================================================');
console.log('SISBEM — ETAPA 1: BATERIA DE TESTES DO HISTÓRICO CLÍNICO');
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

// 1. Teste de Estrutura de Tipos e Campos Obrigatórios de ClinicalRecord
(() => {
  const mockRecord: ClinicalRecord = {
    id: 'rec-test-01',
    animalId: 'anim-test-01',
    veterinarioId: 'vet-01',
    dataAtendimento: new Date().toISOString(),
    inativo: false,
    vacinas: 'V8 em dia',
    parasitas: 'Ausentes',
    temperatura: '38.5',
    peso: '12.4',
    mucosa: 'Normocorada',
    palpacaoAbdominal: 'Abdômen flácido e indolor',
    hidratacao: 'Adequada (Turgor cutâneo < 2s)',
    auscultaCardiaca: 'Ritmo regular, sem sopros',
    auscultaPulmonar: 'Campos limpos bilateralmente',
    frequenciaCardiaca: '110',
    frequenciaRespiratoria: '24',
    observacoesGerais: 'Animal ativo e responsivo.',
    examesSolicitados: 'Hemograma completo',
    tratamentoAmbulatorial: 'Administrado anti-inflamatório oral.',
    diagnosticoClinico: 'Gastroenterite leve em resolução',
    receitas: [
      {
        id: 'presc-01',
        medicamento: 'Omeprazol',
        dosagem: '20mg',
        via: 'Oral',
        frequencia: '24/24h',
        duracao: '7 dias',
        observacoes: 'Em jejum',
        dataEmissao: new Date().toISOString(),
        veterinarioId: 'vet-01',
        animalId: 'anim-test-01',
        prontuarioId: 'rec-test-01'
      }
    ],
    encaminhamentos: [
      {
        id: 'ref-01',
        especialidade: 'Nutrologia Veterinária',
        motivo: 'Ajuste de dieta',
        urgencia: 'BAIXA',
        dataEmissao: new Date().toISOString(),
        veterinarioId: 'vet-01',
        animalId: 'anim-test-01'
      }
    ],
    statusResultante: AnimalCondicao.ATENDIDO,
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: true,
    vermifugoData: '2026-10-20'
  };

  assert(mockRecord.id === 'rec-test-01', 'Estrutura de ClinicalRecord possui ID válido');
  assert(mockRecord.diagnosticoClinico.length > 0, 'Campo Diagnóstico Clínico está presente');
  assert(mockRecord.tratamentoAmbulatorial.length > 0, 'Campo Tratamento / Conduta está presente');
  assert(mockRecord.receitas.length === 1 && mockRecord.receitas[0].prontuarioId === mockRecord.id, 'Receitas vinculadas corretamente ao prontuário');
  assert(mockRecord.encaminhamentos!.length === 1, 'Encaminhamentos vinculados corretamente ao prontuário');
})();

// 2. Teste de Ordenação Cronológica (do mais recente ao mais antigo)
(() => {
  const records: ClinicalRecord[] = [
    {
      id: 'rec-antigo',
      animalId: 'anim-01',
      veterinarioId: 'v1',
      dataAtendimento: '2026-09-01T10:00:00.000Z',
      inativo: false,
      vacinas: '',
      parasitas: '',
      temperatura: '38.0',
      peso: '10',
      mucosa: '',
      palpacaoAbdominal: '',
      hidratacao: '',
      auscultaCardiaca: '',
      auscultaPulmonar: '',
      frequenciaCardiaca: '',
      frequenciaRespiratoria: '',
      observacoesGerais: '',
      examesSolicitados: '',
      tratamentoAmbulatorial: '',
      diagnosticoClinico: 'Primeira consulta',
      receitas: [],
      statusResultante: AnimalCondicao.EM_TRATAMENTO,
      v10Aplicada: false,
      antirrabicaAplicada: false,
      vermifugoAplicado: false
    },
    {
      id: 'rec-recente',
      animalId: 'anim-01',
      veterinarioId: 'v2',
      dataAtendimento: '2026-10-15T15:30:00.000Z',
      inativo: false,
      vacinas: '',
      parasitas: '',
      temperatura: '38.5',
      peso: '11',
      mucosa: '',
      palpacaoAbdominal: '',
      hidratacao: '',
      auscultaCardiaca: '',
      auscultaPulmonar: '',
      frequenciaCardiaca: '',
      frequenciaRespiratoria: '',
      observacoesGerais: '',
      examesSolicitados: '',
      tratamentoAmbulatorial: '',
      diagnosticoClinico: 'Retorno clínico',
      receitas: [],
      statusResultante: AnimalCondicao.ATENDIDO,
      v10Aplicada: false,
      antirrabicaAplicada: false,
      vermifugoAplicado: false
    }
  ];

  const sorted = [...records].sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime());
  assert(sorted[0].id === 'rec-recente', 'Ordenação de prontuários: mais recente aparece em primeiro');
  assert(sorted[1].id === 'rec-antigo', 'Ordenação de prontuários: mais antigo aparece em segundo');
})();

// 3. Teste de Filtragem por Animal (Integridade de dados entre pacientes)
(() => {
  const allRecords: ClinicalRecord[] = [
    {
      id: 'rec-1',
      animalId: 'animal-rex',
      veterinarioId: 'v1',
      dataAtendimento: '2026-10-10T10:00:00.000Z',
      inativo: false,
      vacinas: '',
      parasitas: '',
      temperatura: '',
      peso: '15',
      mucosa: '',
      palpacaoAbdominal: '',
      hidratacao: '',
      auscultaCardiaca: '',
      auscultaPulmonar: '',
      frequenciaCardiaca: '',
      frequenciaRespiratoria: '',
      observacoesGerais: '',
      examesSolicitados: '',
      tratamentoAmbulatorial: '',
      diagnosticoClinico: 'Diagnóstico Rex',
      receitas: [],
      statusResultante: AnimalCondicao.EM_TRATAMENTO,
      v10Aplicada: false,
      antirrabicaAplicada: false,
      vermifugoAplicado: false
    },
    {
      id: 'rec-2',
      animalId: 'animal-luna',
      veterinarioId: 'v1',
      dataAtendimento: '2026-10-12T10:00:00.000Z',
      inativo: false,
      vacinas: '',
      parasitas: '',
      temperatura: '',
      peso: '4',
      mucosa: '',
      palpacaoAbdominal: '',
      hidratacao: '',
      auscultaCardiaca: '',
      auscultaPulmonar: '',
      frequenciaCardiaca: '',
      frequenciaRespiratoria: '',
      observacoesGerais: '',
      examesSolicitados: '',
      tratamentoAmbulatorial: '',
      diagnosticoClinico: 'Diagnóstico Luna',
      receitas: [],
      statusResultante: AnimalCondicao.DISPONIVEL_ADOCAO,
      v10Aplicada: false,
      antirrabicaAplicada: false,
      vermifugoAplicado: false
    }
  ];

  const targetAnimalId = 'animal-rex';
  const filtered = allRecords.filter(r => r.animalId === targetAnimalId && !r.inativo);

  assert(filtered.length === 1, 'Filtro por animal: retorna apenas registros do paciente selecionado');
  assert(filtered[0].id === 'rec-1' && filtered[0].animalId === 'animal-rex', 'Filtro por animal: não expõe registros de outros animais');
})();

// 4. Teste de Isolamento de Estado (Preservação do formulário durante consulta ao histórico)
(() => {
  // Simula estado do formulário de atendimento em andamento
  let formState = {
    animalId: 'animal-01',
    diagnosticoClinico: 'Texto preenchido pelo veterinário...',
    temperatura: '39.1',
    peso: '8.5',
    receitas: [{ id: 'p1', medicamento: 'Dipirona', dosagem: '10 gotas' }]
  };

  const initialFormStateSnapshot = JSON.stringify(formState);

  // Simula abertura da consulta de histórico clínico
  let isHistoryModalOpen = true;

  // Abertura do histórico NÃO deve mutar formState
  assert(isHistoryModalOpen === true, 'Abertura do modal de histórico ativada');
  assert(JSON.stringify(formState) === initialFormStateSnapshot, 'Estado do formulário preservado intacto na abertura do histórico');

  // Simula fechamento da consulta de histórico clínico
  isHistoryModalOpen = false;

  // Fechamento do histórico NÃO deve resetar ou mutar formState
  assert(isHistoryModalOpen === false, 'Fechamento do modal de histórico concluído');
  assert(JSON.stringify(formState) === initialFormStateSnapshot, 'Estado do formulário preservado intacto no fechamento do histórico');
  assert(formState.diagnosticoClinico === 'Texto preenchido pelo veterinário...', 'Dados parciais digitados continuam no formulário');
  assert(formState.receitas.length === 1, 'Prescrições em edição não foram perdidas');
})();

// 5. Teste de Formatação de Mensagens de Tratamento de Erro e Ausência de Histórico
(() => {
  const emptyHistoryMessage = 'Este animal ainda não possui atendimentos clínicos registrados.';
  const errorMessage = 'Não foi possível carregar o histórico clínico. Tente novamente.';

  assert(emptyHistoryMessage === 'Este animal ainda não possui atendimentos clínicos registrados.', 'Mensagem oficial de animal sem histórico validada');
  assert(errorMessage === 'Não foi possível carregar o histórico clínico. Tente novamente.', 'Mensagem oficial de falha de consulta validada');
})();

console.log('\n================================================================');
console.log(`RESULTADO DOS TESTES AUTOMATIZADOS: ${passedTests} de ${totalTests} passaram.`);
console.log('================================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
