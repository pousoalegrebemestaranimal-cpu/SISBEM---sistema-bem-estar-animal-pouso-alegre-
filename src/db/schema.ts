import { pgTable, text, boolean, timestamp, doublePrecision, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// 1. Usuários do Sistema SISBEM (Operadores, Vets, Admins)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID
  email: text('email'),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  role: text('role').notNull(), // 'ADMIN' | 'OPERATOR' | 'VETERINARIO'
  crmv: text('crmv'),
  matricula: text('matricula'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Solicitantes (Cidadão, Protetor, ONG, Órgão Público)
export const solicitantes = pgTable('solicitantes', {
  id: text('id').primaryKey(),
  nomeCompleto: text('nome_completo').notNull(),
  cpf: text('cpf').notNull(),
  telefone: text('telefone').notNull(),
  tipo: text('tipo'), // 'CIDADAO' | 'ONG' | 'PROTETOR' | 'ORGAO_PUBLICO' | 'DESCONHECIDO'
  codigoOng: text('codigo_ong'),
  responsavel: text('responsavel'),
  endereco: text('endereco'),
  email: text('email'),
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Tutores cadastrados
export const tutores = pgTable('tutores', {
  id: text('id').primaryKey(),
  nomeCompleto: text('nome_completo').notNull(),
  cpf: text('cpf').notNull(),
  telefone: text('telefone').notNull(),
  endereco: text('endereco'),
  temCadUnico: boolean('tem_cad_unico').default(false).notNull(),
  documentoCadUnico: text('documento_cad_unico'),
  dataCadastro: text('data_cadastro'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Estrutura de Baias e Acomodações
export const kennels = pgTable('kennels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'Individual' | 'Coletiva' | 'Quarentena' | 'Gatil' | 'Pré-operatório' | 'Pós-operatório'
  capacity: integer('capacity').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Animais
export const animals = pgTable('animals', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  peso: doublePrecision('peso').default(0).notNull(),
  idade: text('idade'),
  corPelagem: text('cor_pelagem').notNull(),
  especie: text('especie').notNull(), // 'Cão' | 'Gato'
  raca: text('raca').notNull(),
  porte: text('porte').notNull(), // 'Pequeno' | 'Médio' | 'Grande'
  sexo: text('sexo').notNull(), // 'Macho' | 'Fêmea'
  castrado: boolean('castrado').default(false).notNull(),
  microchipado: boolean('microchipado').default(false),
  numeroMicrochip: text('numero_microchip'),
  temTutor: boolean('tem_tutor').default(false).notNull(),
  localResgate: text('local_resgate').notNull(),
  dataResgate: text('data_resgate').notNull(),
  motivo: text('motivo').default(''),
  dataCadastro: text('data_cadastro').notNull(),
  usuarioResponsavelId: text('usuario_responsavel_id').references(() => users.id),
  solicitanteId: text('solicitante_id').references(() => solicitantes.id),
  tutorId: text('tutor_id').references(() => tutores.id),
  condicao: text('condicao').notNull(), // AnimalCondicao enum values
  resgateSamuvet: boolean('resgate_samuvet').default(false).notNull(),
  responsavelSamuvet: text('responsavel_samuvet'),
  foto: text('foto'),
  dataObito: text('data_obito'),
  causaObito: text('causa_obito'),
  dataSoltura: text('data_soltura'),
  localSoltura: text('local_soltura'),
  dataAdocao: text('data_adocao'),
  adotanteNome: text('adotante_nome'),
  adotanteCpf: text('adotante_cpf'),
  adotanteTelefone: text('adotante_telefone'),
  necessitaInternacao: boolean('necessita_internacao').default(false),
  tipoAcomodacaoSugerida: text('tipo_acomodacao_sugerida'),
  justificativaInternacao: text('justificativa_internacao'),
  dataInternacao: text('data_internacao'),
  emAtendimentoVetId: text('em_atendimento_vet_id').references(() => users.id),
  emAtendimentoInicio: timestamp('em_atendimento_inicio', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_animals_single_active_attendance')
    .on(table.id)
    .where(sql`condicao = 'Em Atendimento'`),
  index('idx_animals_em_atendimento_vet_id')
    .on(table.emAtendimentoVetId),
]);

// 6. Ocupação de Baias
export const kennelOccupations = pgTable('kennel_occupations', {
  id: text('id').primaryKey(),
  kennelId: text('kennel_id').references(() => kennels.id).notNull(),
  animalId: text('animal_id').references(() => animals.id).notNull(),
  entryDate: text('entry_date').notNull(),
  exitDate: text('exit_date'),
  vetId: text('vet_id').notNull(),
  clinicalRecordId: text('clinical_record_id'),
  justification: text('justification').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_kennel_occupations_single_active')
    .on(table.animalId)
    .where(sql`exit_date IS NULL`),
]);

// 7. Prontuários Clínicos Veterinários
export const clinicalRecords = pgTable('clinical_records', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').references(() => animals.id).notNull(),
  veterinarioId: text('veterinario_id').references(() => users.id).notNull(),
  dataAtendimento: text('data_atendimento').notNull(),
  inativo: boolean('inativo').default(false).notNull(),
  vacinas: text('vacinas'),
  parasitas: text('parasitas'),
  temperatura: text('temperatura'),
  peso: text('peso'),
  mucosa: text('mucosa'),
  palpacaoAbdominal: text('palpacao_abdominal'),
  hidratacao: text('hidratacao'),
  auscultaCardiaca: text('ausculta_cardiaca'),
  auscultaPulmonar: text('ausculta_pulmonar'),
  frequenciaCardiaca: text('frequencia_cardiaca'),
  frequenciaRespiratoria: text('frequencia_respiratoria'),
  observacoesGerais: text('observacoes_gerais'),
  examesSolicitados: text('exames_solicitados'),
  tratamentoAmbulatorial: text('tratamento_ambulatorial'),
  diagnosticoClinico: text('diagnostico_clinico'),
  statusResultante: text('status_resultante').notNull(),
  dataObito: text('data_obito'),
  causaObito: text('causa_obito'),
  dataSoltura: text('data_soltura'),
  localSoltura: text('local_soltura'),
  recommendedKennelType: text('recommended_kennel_type'),
  accommodationJustification: text('accommodation_justification'),
  necessitaInternacao: boolean('necessita_internacao').default(false),
  v10Aplicada: boolean('v10_aplicada').default(false),
  v10Data: text('v10_data'),
  antirrabicaAplicada: boolean('antirrabica_aplicada').default(false),
  antirrabicaData: text('antirrabica_data'),
  vermifugoAplicado: boolean('vermifugo_aplicado').default(false),
  vermifugoData: text('vermifugo_data'),
  microchipAplicado: boolean('microchip_aplicado').default(false),
  numeroMicrochipAplicado: text('numero_microchip_aplicado'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. Receituários e Medicamentos
export const prescriptions = pgTable('prescriptions', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').references(() => animals.id).notNull(),
  prontuarioId: text('prontuario_id').references(() => clinicalRecords.id),
  veterinarioId: text('veterinario_id').references(() => users.id).notNull(),
  medicamento: text('medicamento').notNull(),
  dosagem: text('dosagem').notNull(),
  via: text('via').notNull(),
  frequencia: text('frequencia').notNull(),
  duracao: text('duracao').notNull(),
  observacoes: text('observacoes'),
  dataEmissao: text('data_emissao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Encaminhamentos Veterinários
export const referrals = pgTable('referrals', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').references(() => animals.id).notNull(),
  veterinarioId: text('veterinario_id').references(() => users.id).notNull(),
  especialidade: text('especialidade').notNull(),
  motivo: text('motivo').notNull(),
  localSugerido: text('local_sugerido'),
  urgencia: text('urgencia').notNull(), // 'BAIXA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA'
  dataEmissao: text('data_emissao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. Agendamentos e Procedimentos Cirúrgicos / Castrações
export const surgeries = pgTable('surgeries', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').references(() => animals.id).notNull(),
  dataAgendada: text('data_agendada').notNull(),
  horario: text('horario'),
  turno: text('turno'), // 'MANHA' | 'TARDE' | 'INTEGRAL'
  tipoCirurgia: text('tipo_cirurgia').notNull(),
  status: text('status').notNull(), // 'Agendada' | 'Em Pré-operatório' | 'Realizada' | 'Cancelada'
  prioridade: text('prioridade').notNull(), // 'Normal' | 'Urgente' | 'Fila de Espera'
  veterinarioResponsavelId: text('veterinario_responsavel_id').references(() => users.id),
  veterinarioResponsavelNome: text('veterinario_responsavel_nome'),
  observacoesPreOperatorias: text('observacoes_pre_operatorias'),
  observacoesPosOperatorias: text('observacoes_pos_operatorias'),
  receitasPosOperatorias: jsonb('receitas_pos_operatorias'),
  dataRealizacao: text('data_realizacao'),
  realizadaPorId: text('realizada_por_id').references(() => users.id),
  realizadaPorNome: text('realizada_por_nome'),
  motivoCancelamento: text('motivo_cancelamento'),
  dataCadastro: text('data_cadastro').notNull(),
  usuarioCriadorId: text('usuario_criador_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. Histórico de Mudanças de Status (Auditoria)
export const statusLogs = pgTable('status_logs', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').references(() => animals.id).notNull(),
  statusAnterior: text('status_anterior'),
  statusNovo: text('status_novo').notNull(),
  dataAlteracao: text('data_alteracao').notNull(),
  usuarioId: text('usuario_id').references(() => users.id).notNull(),
  prontuarioId: text('prontuario_id').references(() => clinicalRecords.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 12. Arquivos e Laudos Anexados
export const examFiles = pgTable('exam_files', {
  id: text('id').primaryKey(),
  prontuarioId: text('prontuario_id').references(() => clinicalRecords.id).notNull(),
  nomeExame: text('nome_exame').notNull(),
  arquivo: text('arquivo').notNull(), // Base64 ou URL
  dataAnexo: text('data_anexo').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relacionamentos Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  animals: many(animals),
  clinicalRecords: many(clinicalRecords),
  prescriptions: many(prescriptions),
  referrals: many(referrals),
  surgeries: many(surgeries),
}));

export const animalsRelations = relations(animals, ({ one, many }) => ({
  solicitante: one(solicitantes, {
    fields: [animals.solicitanteId],
    references: [solicitantes.id],
  }),
  tutor: one(tutores, {
    fields: [animals.tutorId],
    references: [tutores.id],
  }),
  usuarioResponsavel: one(users, {
    fields: [animals.usuarioResponsavelId],
    references: [users.id],
  }),
  clinicalRecords: many(clinicalRecords),
  prescriptions: many(prescriptions),
  referrals: many(referrals),
  surgeries: many(surgeries),
  occupations: many(kennelOccupations),
  statusLogs: many(statusLogs),
}));

export const clinicalRecordsRelations = relations(clinicalRecords, ({ one, many }) => ({
  animal: one(animals, {
    fields: [clinicalRecords.animalId],
    references: [animals.id],
  }),
  veterinario: one(users, {
    fields: [clinicalRecords.veterinarioId],
    references: [users.id],
  }),
  prescriptions: many(prescriptions),
  examFiles: many(examFiles),
}));

export const kennelsRelations = relations(kennels, ({ many }) => ({
  occupations: many(kennelOccupations),
}));
