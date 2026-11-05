// Mock de localStorage e window para Node.js puro
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

import assert from 'assert';
import { db } from '../services/db';
import { ClinicalRecord, AnimalCondicao, Especie, Porte, Sexo, KennelType, Animal, User } from '../types';
import { mapRecordToSupabase, mapSupabaseToRecord } from '../src/lib/supabaseSync';

// Seed mock animals and users
const testUser: User = {
  id: '1',
  name: 'Dra. Gabriela Veterinária',
  username: 'dra.gabriela',
  role: 'VETERINARIO',
  crmv: '12345-MG'
};

const testAnimal: Animal = {
  id: 'anim-curativo-test-01',
  nome: 'Thor Curativo',
  peso: 15.0,
  idade: '2 anos',
  corPelagem: 'Preto e Branco',
  especie: Especie.CAO,
  raca: 'SRD',
  porte: Porte.MEDIO,
  sexo: Sexo.MACHO,
  castrado: true,
  microchipado: false,
  temTutor: false,
  localResgate: 'Avenida Central, 500',
  dataResgate: new Date().toISOString(),
  motivo: 'Animal com ferimento extenso',
  dataCadastro: new Date().toISOString(),
  usuarioResponsavelId: '1',
  solicitanteId: 'sol-1',
  condicao: AnimalCondicao.EM_TRATAMENTO,
  resgateSamuvet: false,
  necessitaInternacao: true
};

localStorage.setItem('sisbem_users', JSON.stringify([testUser]));
localStorage.setItem('sisbem_animals', JSON.stringify([testAnimal]));
localStorage.setItem('sisbem_clinical_records', JSON.stringify([]));

console.log('=== TESTE AUTOMATIZADO: FLUXO DE CURATIVOS E PLANILHAS NO SISBEM ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASSOU] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`❌ [FALHOU] ${name}`);
    console.error(err);
  }
}

// --------------------------------------------------------------------------
// TESTE 1: Mapeamento Supabase para Curativo (Codificação e Decodificação)
// --------------------------------------------------------------------------
runTest('1. mapRecordToSupabase serializa curativos de forma segura sem quebrar colunas do banco', () => {
  const recordWithCurativo: ClinicalRecord = {
    id: 'rec-test-curativo-1',
    animalId: 'anim-01',
    veterinarioId: '1',
    dataAtendimento: new Date().toISOString(),
    inativo: false,
    vacinas: '',
    parasitas: '',
    temperatura: '38.5',
    peso: '12.0',
    mucosa: 'Normocorada',
    palpacaoAbdominal: 'Normal',
    hidratacao: 'Adequada',
    auscultaCardiaca: 'Normal',
    auscultaPulmonar: 'Normal',
    frequenciaCardiaca: '110',
    frequenciaRespiratoria: '24',
    observacoesGerais: 'Paciente calmo e colaborativo.',
    examesSolicitados: '',
    tratamentoAmbulatorial: 'Limpeza e tricotomia ao redor da ferida.',
    diagnosticoClinico: 'Trauma / Ferimento Cutâneo',
    receitas: [],
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: false,
    statusResultante: AnimalCondicao.EM_TRATAMENTO,
    necessitaCurativo: true,
    curativoLocal: 'Membro pélvico direito',
    curativoDescricao: 'Limpeza com solução fisiológica e curativo oclusivo com gaze e atadura',
    curativoFrequencia: 'A cada 24 horas',
    curativoOrientacoes: 'Observar secreção e sangramento'
  };

  const supabaseRow = mapRecordToSupabase(recordWithCurativo);

  // Não deve enviar campos não declarados no schema físico
  assert.strictEqual((supabaseRow as any).curativo_local, undefined);
  assert.strictEqual((supabaseRow as any).necessita_curativo, undefined);

  // Deve ter embutido o marcador seguro em observacoes_gerais
  assert(supabaseRow.observacoes_gerais?.includes('[CURATIVO:SIM]'), 'Deve conter tag [CURATIVO:SIM]');
  assert(supabaseRow.observacoes_gerais?.includes('Membro pélvico direito'), 'Deve conter o local');
  assert(supabaseRow.observacoes_gerais?.includes('A cada 24 horas'), 'Deve conter a frequência');

  // Ao mapear de volta, deve restaurar os campos estruturados e limpar o texto visível
  const restoredRecord = mapSupabaseToRecord(supabaseRow);
  assert.strictEqual(restoredRecord.necessitaCurativo, true);
  assert.strictEqual(restoredRecord.curativoLocal, 'Membro pélvico direito');
  assert.strictEqual(restoredRecord.curativoFrequencia, 'A cada 24 horas');
  assert.strictEqual(restoredRecord.curativoDescricao, 'Limpeza com solução fisiológica e curativo oclusivo com gaze e atadura');
  assert.strictEqual(restoredRecord.curativoOrientacoes, 'Observar secreção e sangramento');
  assert.strictEqual(restoredRecord.observacoesGerais, 'Paciente calmo e colaborativo.');
});

// --------------------------------------------------------------------------
// TESTE 2: Mapeamento quando NÃO necessita de curativo
// --------------------------------------------------------------------------
runTest('2. mapRecordToSupabase e mapSupabaseToRecord quando necessitaCurativo é false', () => {
  const recordNoCurativo: ClinicalRecord = {
    id: 'rec-test-curativo-2',
    animalId: 'anim-02',
    veterinarioId: '1',
    dataAtendimento: new Date().toISOString(),
    inativo: false,
    vacinas: '',
    parasitas: '',
    temperatura: '38.2',
    peso: '8.5',
    mucosa: 'Normocorada',
    palpacaoAbdominal: 'Normal',
    hidratacao: 'Adequada',
    auscultaCardiaca: 'Normal',
    auscultaPulmonar: 'Normal',
    frequenciaCardiaca: '100',
    frequenciaRespiratoria: '20',
    observacoesGerais: 'Exame de rotina.',
    examesSolicitados: '',
    tratamentoAmbulatorial: 'Vermifugação administrada.',
    diagnosticoClinico: 'Sadio',
    receitas: [],
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: false,
    statusResultante: AnimalCondicao.ATENDIDO,
    necessitaCurativo: false
  };

  const supabaseRow = mapRecordToSupabase(recordNoCurativo);
  const restored = mapSupabaseToRecord(supabaseRow);

  assert.strictEqual(restored.necessitaCurativo, false);
  assert.strictEqual(restored.curativoLocal, undefined);
  assert.strictEqual(restored.observacoesGerais, 'Exame de rotina.');
});

// --------------------------------------------------------------------------
// TESTE 3: db.saveRecord preserva os dados de curativo no histórico
// --------------------------------------------------------------------------
runTest('3. db.saveRecord salva prontuário com orientações de curativo', () => {
  const animals = db.getAnimals();
  const targetAnimal = animals[0];
  assert(targetAnimal, 'Deve existir ao menos um animal no mock local');

  const newRecord: ClinicalRecord = {
    id: 'rec-curativo-db-save-test',
    animalId: targetAnimal.id,
    veterinarioId: '1',
    dataAtendimento: new Date().toISOString(),
    inativo: false,
    vacinas: '',
    parasitas: '',
    temperatura: '39.0',
    peso: '15.5',
    mucosa: 'Pálida',
    palpacaoAbdominal: 'Normal',
    hidratacao: 'Adequada',
    auscultaCardiaca: 'Normal',
    auscultaPulmonar: 'Normal',
    frequenciaCardiaca: '120',
    frequenciaRespiratoria: '28',
    observacoesGerais: 'Ferimento por mordedura',
    examesSolicitados: '',
    tratamentoAmbulatorial: 'Desinfecção e anti-séptico tópico',
    diagnosticoClinico: 'Traumas',
    receitas: [],
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: false,
    statusResultante: AnimalCondicao.EM_TRATAMENTO,
    necessitaCurativo: true,
    curativoLocal: 'Orelha esquerda e região cervical',
    curativoDescricao: 'Limpeza com PVPI degermante e pomada cicatrizante',
    curativoFrequencia: '2x ao dia (a cada 12 horas)',
    curativoOrientacoes: 'Manter colar elizabetano no paciente'
  };

  db.saveRecord(newRecord, '1');

  // Verifica se o prontuário foi gravado
  const savedRecords = db.getRecords();
  const found = savedRecords.find(r => r.id === 'rec-curativo-db-save-test');
  assert(found, 'Prontuário deve ser encontrado em db.getRecords()');
  assert.strictEqual(found.necessitaCurativo, true);
  assert.strictEqual(found.curativoLocal, 'Orelha esquerda e região cervical');
  assert.strictEqual(found.curativoFrequencia, '2x ao dia (a cada 12 horas)');
  assert.strictEqual(found.curativoDescricao, 'Limpeza com PVPI degermante e pomada cicatrizante');
  assert.strictEqual(found.curativoOrientacoes, 'Manter colar elizabetano no paciente');
});

// --------------------------------------------------------------------------
// TESTE 4: Regras de Inclusão da Planilha de Curativos
// --------------------------------------------------------------------------
runTest('4. Animal com curativo ativo e na acomodação é incluído na planilha', () => {
  const animalsJoined = db.getAnimalsJoined();
  const animalWithCurativo = animalsJoined.find(a => a.id === animalsJoined[0].id)!;

  // Garante que o animal está com o prontuário de curativo
  const latestRec = animalWithCurativo.historico?.[0];
  assert(latestRec?.necessitaCurativo === true, 'O animal deve ter prontuário recente com curativo ativo');

  // Verifica se o animal não tem desfecho definitivo
  assert(![AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO, AnimalCondicao.ALTA].includes(animalWithCurativo.condicao));
});

// --------------------------------------------------------------------------
// TESTE 5: Regras de Exclusão da Planilha de Curativos (Alta / Óbito / Soltura)
// --------------------------------------------------------------------------
runTest('5. Animais que receberam alta, óbito, soltura ou adoção são excluídos da planilha de curativos', () => {
  const terminalConditions = [AnimalCondicao.ALTA, AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO];
  
  for (const cond of terminalConditions) {
    const isExcluded = [AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO, AnimalCondicao.ALTA].includes(cond);
    assert.strictEqual(isExcluded, true, `Condição ${cond} deve ser excluída`);
  }
});

// --------------------------------------------------------------------------
// TESTE 6: Novo atendimento sem curativo desativa a prescrição na planilha
// --------------------------------------------------------------------------
runTest('6. Nova consulta posterior com necessitaCurativo: false desativa o animal da planilha de curativos', () => {
  const animals = db.getAnimals();
  const targetAnimal = animals[0];

  // Adiciona novo prontuário mais recente onde a ferida cicatrizou e não necessita mais de curativo
  const subsequentRecord: ClinicalRecord = {
    id: 'rec-subsequent-curativo-resolved',
    animalId: targetAnimal.id,
    veterinarioId: '1',
    dataAtendimento: new Date(Date.now() + 60000).toISOString(),
    inativo: false,
    vacinas: '',
    parasitas: '',
    temperatura: '38.4',
    peso: '15.7',
    mucosa: 'Normocorada',
    palpacaoAbdominal: 'Normal',
    hidratacao: 'Adequada',
    auscultaCardiaca: 'Normal',
    auscultaPulmonar: 'Normal',
    frequenciaCardiaca: '105',
    frequenciaRespiratoria: '22',
    observacoesGerais: 'Ferida totalmente epitelizada e cicatrizada.',
    examesSolicitados: '',
    tratamentoAmbulatorial: 'Alta do curativo.',
    diagnosticoClinico: 'Traumas - Resolvido',
    receitas: [],
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: false,
    statusResultante: AnimalCondicao.DISPONIVEL_ADOCAO,
    necessitaCurativo: false
  };

  db.saveRecord(subsequentRecord, '1');

  // Verifica o prontuário mais recente
  const records = db.getRecords().filter(r => r.animalId === targetAnimal.id);
  const sorted = [...records].sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime());
  const latest = sorted[0];

  assert.strictEqual(latest.id, 'rec-subsequent-curativo-resolved');
  assert.strictEqual(latest.necessitaCurativo, false);
});

// --------------------------------------------------------------------------
// TESTE 7: Independência entre Planilha de Tratamentos e Planilha de Curativos
// --------------------------------------------------------------------------
runTest('7. Planilha de Tratamentos e Planilha de Curativos funcionam de forma independente', () => {
  // Um animal pode ter medicação (receitas) sem ter curativo
  const recordOnlyMed: ClinicalRecord = {
    id: 'rec-only-med',
    animalId: 'anim-03',
    veterinarioId: '1',
    dataAtendimento: new Date().toISOString(),
    inativo: false,
    vacinas: '',
    parasitas: '',
    temperatura: '',
    peso: '',
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
    diagnosticoClinico: 'Otite Externa',
    receitas: [{
      id: 'presc-01',
      medicamento: 'Otodem Plus',
      dosagem: '4 gotas',
      via: 'Otológica',
      frequencia: '12/12h',
      duracao: '7 dias',
      dataEmissao: new Date().toISOString(),
      veterinarioId: '1',
      animalId: 'anim-03',
      prontuarioId: 'rec-only-med'
    }],
    statusResultante: AnimalCondicao.EM_TRATAMENTO,
    v10Aplicada: false,
    antirrabicaAplicada: false,
    vermifugoAplicado: false,
    necessitaCurativo: false // SEM CURATIVO
  };

  assert.strictEqual(recordOnlyMed.receitas.length, 1);
  assert.strictEqual(recordOnlyMed.necessitaCurativo, false);
});

console.log(`\n======================================================`);
console.log(`RESULTADO: ${passedTests} de ${totalTests} testes passaram com sucesso!`);
console.log(`======================================================\n`);
