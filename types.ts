
export enum Especie {
  CAO = 'Cão',
  GATO = 'Gato'
}

export enum Porte {
  PEQUENO = 'Pequeno',
  MEDIO = 'Médio',
  GRANDE = 'Grande'
}

export enum Sexo {
  MACHO = 'Macho',
  FEMEA = 'Fêmea'
}

export enum AnimalCondicao {
  ACOLHIDO = 'Acolhido',
  AGUARDANDO_ATENDIMENTO = 'Aguardando Atendimento',
  EM_TRATAMENTO = 'Em Tratamento',
  DISPONIVEL_ADOCAO = 'Disponível para Adoção',
  ADOTADO = 'Adotado',
  OBITO = 'Óbito',
  SOLTURA = 'Soltura',
  ATENDIDO = 'Atendido'
}

export enum KennelType {
  INDIVIDUAL = 'Individual',
  COLETIVA = 'Coletiva',
  QUARENTENA = 'Quarentena',
  GATIL = 'Gatil',
  PRE_OPERATORIO = 'Pré-operatório',
  POS_OPERATORIO = 'Pós-operatório'
}

export interface KennelConfig {
  type: KennelType;
  count: number;
  capacity: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO';
  crmv?: string;
  matricula?: string;
}

export interface Solicitante {
  id: string;
  nomeCompleto: string;
  cpf: string; // CPF ou CNPJ / Código Identificador
  telefone: string;
  tipo?: 'CIDADAO' | 'ONG' | 'PROTETOR' | 'ORGAO_PUBLICO' | 'DESCONHECIDO';
  codigoOng?: string; // Código exclusivo para identificação da ONG (ex: ONG-01, ONG-VPA)
  responsavel?: string; // Nome do representante / presidente / voluntário responsável
  endereco?: string;
  email?: string;
  observacoes?: string;
}

export interface Tutor {
  id: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string;
  endereco?: string;
  dataCadastro: string;
  temCadUnico: boolean;
  documentoCadUnico?: string; // Base64
}

export interface Adotante {
  nome: string;
  cpf: string;
  telefone: string;
}

export interface Prescription {
  id: string;
  medicamento: string;
  dosagem: string;
  via: string;
  frequencia: string;
  duracao: string;
  observacoes?: string;
  dataEmissao: string;
  veterinarioId: string;
  animalId: string;
  prontuarioId: string;
}

export interface Referral {
  id: string;
  especialidade: string;
  motivo: string;
  localSugerido?: string;
  urgencia: 'BAIXA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';
  dataEmissao: string;
  veterinarioId: string;
  animalId: string;
}

export interface ExamFile {
  id: string;
  nomeExame: string;
  arquivo: string; // Base64
  dataAnexo: string;
}

export interface Kennel {
  id: string;
  name: string;
  type: KennelType;
  capacity: number;
}

export interface KennelOccupation {
  id: string;
  kennelId: string;
  animalId: string;
  entryDate: string;
  exitDate?: string;
  vetId: string;
  clinicalRecordId?: string;
  justification: string;
}

export interface ClinicalRecord {
  id: string;
  animalId: string;
  veterinarioId: string;
  dataAtendimento: string;
  inativo: boolean;
  vacinas: string;
  parasitas: string;
  temperatura: string;
  peso: string;
  mucosa: string;
  palpacaoAbdominal: string;
  hidratacao: string;
  auscultaCardiaca: string;
  auscultaPulmonar: string;
  frequenciaCardiaca: string;
  frequenciaRespiratoria: string;
  observacoesGerais: string;
  examesSolicitados: string;
  tratamentoAmbulatorial: string;
  diagnosticoClinico: string;
  receitas: Prescription[];
  encaminhamentos?: Referral[];
  examesLaboratoriais?: ExamFile[];
  statusResultante: AnimalCondicao;
  dataObito?: string;
  causaObito?: string;
  dataSoltura?: string;
  localSoltura?: string;
  recommendedKennelType?: KennelType;
  accommodationJustification?: string;
  necessitaInternacao?: boolean;
  v10Aplicada: boolean;
  v10Data?: string;
  antirrabicaAplicada: boolean;
  antirrabicaData?: string;
  vermifugoAplicado: boolean;
  vermifugoData?: string;
  microchipAplicado?: boolean;
  numeroMicrochipAplicado?: string;
}

export interface StatusLog {
  id: string;
  animalId: string;
  statusAnterior: AnimalCondicao | null;
  statusNovo: AnimalCondicao;
  dataAlteracao: string;
  usuarioId: string;
  prontuarioId?: string;
}

export interface Animal {
  id: string;
  nome: string;
  peso: number;
  idade?: string;
  corPelagem: string;
  especie: Especie;
  raca: string;
  porte: Porte;
  sexo: Sexo;
  castrado: boolean;
  microchipado?: boolean;
  numeroMicrochip?: string;
  temTutor: boolean;
  localResgate: string;
  dataResgate: string;
  motivo: string;
  dataCadastro: string;
  usuarioResponsavelId: string;
  solicitanteId: string;
  tutorId?: string;
  condicao: AnimalCondicao;
  resgateSamuvet: boolean;
  responsavelSamuvet?: string;
  foto?: string;
  dataObito?: string;
  causaObito?: string;
  dataSoltura?: string;
  localSoltura?: string;
  dataAdocao?: string;
  adotante?: Adotante;
  necessitaInternacao?: boolean;
  tipoAcomodacaoSugerida?: KennelType;
  justificativaInternacao?: string;
  dataInternacao?: string;
}

export interface AnimalJoined extends Animal {
  solicitante?: Solicitante;
  tutor?: Tutor;
  usuarioResponsavel?: User;
  historico?: ClinicalRecord[];
  statusLogs?: StatusLog[];
  currentOccupation?: KennelOccupation & { kennel?: Kennel };
  cirurgias?: AgendamentoCirurgia[];
  agendamentoCastracaoAtivo?: AgendamentoCirurgia;
}

export enum CirurgiaStatus {
  AGENDADA = 'Agendada',
  EM_PREPARO = 'Em Pré-operatório',
  REALIZADA = 'Realizada',
  CANCELADA = 'Cancelada'
}

export enum CirurgiaPrioridade {
  NORMAL = 'Normal',
  URGENTE = 'Urgente',
  FILA_ESPERA = 'Fila de Espera'
}

export interface AgendamentoCirurgia {
  id: string;
  animalId: string;
  dataAgendada: string; // YYYY-MM-DD
  horario?: string; // ex: "08:30" ou "Manhã"
  turno?: 'MANHA' | 'TARDE' | 'INTEGRAL';
  tipoCirurgia: string; // 'Castração (Orquiectomia)' | 'Castração (OSH / Ovariohisterectomia)' | 'Castração Preventiva' | 'Procedimento Cirúrgico'
  status: CirurgiaStatus;
  prioridade: CirurgiaPrioridade;
  veterinarioResponsavelId?: string;
  veterinarioResponsavelNome?: string;
  observacoesPreOperatorias?: string; // Jejum de 8h, exames prévios
  observacoesPosOperatorias?: string;
  receitasPosOperatorias?: Prescription[];
  dataRealizacao?: string;
  realizadaPorId?: string;
  realizadaPorNome?: string;
  motivoCancelamento?: string;
  dataCadastro: string;
  usuarioCriadorId: string;
}

export interface CirurgiaJoined extends AgendamentoCirurgia {
  animal?: AnimalJoined;
  veterinarioResponsavel?: User;
  usuarioCriador?: User;
}

export interface DashboardStats {
  totalAnimais: number;
  totalCaes: number;
  totalGatos: number;
  totalResgatesMes: number;
  totalCirurgiasAgendadas?: number;
  totalNaoCastrados?: number;
}
