import { supabase } from './supabase';
import { hashPassword } from './authCrypto';
import { safeSetLocalAnimals, isBase64Photo, safeSetItem } from './safeStorage';
import {
  Animal,
  Solicitante,
  Tutor,
  Kennel,
  KennelOccupation,
  ClinicalRecord,
  AgendamentoCirurgia,
  StatusLog,
  User,
  AnimalCondicao,
  Especie,
  Porte,
  Sexo,
  KennelType,
  KennelConfig,
  CirurgiaStatus,
  CirurgiaPrioridade
} from '../../types';

export interface SyncStats {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastError: string | null;
  counts: {
    animals: number;
    solicitantes: number;
    tutores: number;
    kennels: number;
    occupations: number;
    surgeries: number;
    records: number;
    users: number;
  };
}

let syncState: SyncStats = {
  lastSyncAt: null,
  status: 'idle',
  lastError: null,
  counts: {
    animals: 0,
    solicitantes: 0,
    tutores: 0,
    kennels: 0,
    occupations: 0,
    surgeries: 0,
    records: 0,
    users: 0,
  }
};

const listeners = new Set<(state: SyncStats) => void>();

export function subscribeSyncState(fn: (state: SyncStats) => void) {
  listeners.add(fn);
  fn({ ...syncState });
  return () => {
    listeners.delete(fn);
  };
}

function updateSyncState(patch: Partial<SyncStats>) {
  syncState = { ...syncState, ...patch };
  listeners.forEach(fn => fn({ ...syncState }));
  try {
    localStorage.setItem('sisbem_sync_stats', JSON.stringify(syncState));
  } catch (e) {
    // Ignore storage issues
  }
}

// Load cached sync state
try {
  const cached = localStorage.getItem('sisbem_sync_stats');
  if (cached) {
    syncState = { ...syncState, ...JSON.parse(cached), status: 'idle' };
  }
} catch (e) {
  // Ignore
}

/**
 * Normaliza campos nulos para evitar violações de integridade no Supabase
 */
function cleanString(str?: string | null): string | null {
  if (!str) return null;
  const t = str.trim();
  return t.length > 0 ? t : null;
}

export function normalizeEspecie(val: any): string {
  if (!val) return 'Cão';
  const s = String(val).toLowerCase().trim();
  if (s.includes('gat') || s.includes('felin')) return 'Gato';
  return 'Cão';
}

export function normalizePorte(val: any): string {
  if (!val) return 'Médio';
  const s = String(val).toLowerCase().trim();
  if (s.includes('peq') || s.includes('small')) return 'Pequeno';
  if (s.includes('gran') || s.includes('large')) return 'Grande';
  return 'Médio';
}

export function normalizeSexo(val: any): string {
  if (!val) return 'Macho';
  const s = String(val).toLowerCase().trim();
  if (s.includes('f') || s.includes('fêm') || s.includes('fem')) return 'Fêmea';
  return 'Macho';
}

export function normalizeCirurgiaTurno(val: any): 'MANHA' | 'TARDE' | 'INTEGRAL' {
  if (!val) return 'MANHA';
  const s = String(val).toUpperCase().trim();
  if (s.includes('TARDE')) return 'TARDE';
  if (s.includes('INTEGRAL')) return 'INTEGRAL';
  return 'MANHA';
}

export function normalizeCirurgiaStatus(val: any): 'Agendada' | 'Em Pré-operatório' | 'Realizada' | 'Cancelada' {
  if (!val) return 'Agendada';
  const s = String(val).trim();
  if (s === 'Em Pré-operatório' || s === 'Pre-operatorio' || s === 'Pre-operatório') return 'Em Pré-operatório';
  if (s === 'Realizada' || s === 'Concluída' || s === 'Concluida') return 'Realizada';
  if (s === 'Cancelada') return 'Cancelada';
  return 'Agendada';
}

export function normalizeCirurgiaPrioridade(val: any): 'Normal' | 'Urgente' | 'Fila de Espera' {
  if (!val) return 'Normal';
  const s = String(val).trim();
  if (s === 'Urgente') return 'Urgente';
  if (s === 'Fila de Espera' || s.includes('Espera')) return 'Fila de Espera';
  return 'Normal';
}

// ==============================================================================
// MAPEADORES: Local (camelCase) <-> Supabase (snake_case)
// ==============================================================================

export function mapSolicitanteToSupabase(s: Solicitante) {
  return {
    id: s.id,
    nome_completo: s.nomeCompleto || 'Não informado',
    cpf: s.cpf || 'Não informado',
    telefone: s.telefone || 'Não informado',
    tipo: s.tipo || 'CIDADAO',
    codigo_ong: cleanString(s.codigoOng),
    responsavel: cleanString(s.responsavel),
    endereco: cleanString(s.endereco),
    email: cleanString(s.email),
    observacoes: cleanString(s.observacoes),
  };
}

export function mapSupabaseToSolicitante(row: any): Solicitante {
  return {
    id: row.id,
    nomeCompleto: row.nome_completo,
    cpf: row.cpf,
    telefone: row.telefone,
    tipo: row.tipo || 'CIDADAO',
    codigoOng: row.codigo_ong || undefined,
    responsavel: row.responsavel || undefined,
    endereco: row.endereco || undefined,
    email: row.email || undefined,
    observacoes: row.observacoes || undefined,
  };
}

export function mapTutorToSupabase(t: Tutor) {
  return {
    id: t.id,
    nome_completo: t.nomeCompleto || 'Não informado',
    cpf: t.cpf || 'Não informado',
    telefone: t.telefone || 'Não informado',
    endereco: cleanString(t.endereco),
    tem_cad_unico: !!t.temCadUnico,
    documento_cad_unico: cleanString(t.documentoCadUnico),
    data_cadastro: cleanString(t.dataCadastro) || new Date().toISOString(),
  };
}

export function mapSupabaseToTutor(row: any): Tutor {
  return {
    id: row.id,
    nomeCompleto: row.nome_completo,
    cpf: row.cpf,
    telefone: row.telefone,
    endereco: row.endereco || undefined,
    temCadUnico: !!row.tem_cad_unico,
    documentoCadUnico: row.documento_cad_unico || undefined,
    dataCadastro: row.data_cadastro || new Date().toISOString(),
  };
}

export function mapKennelToSupabase(k: Kennel) {
  return {
    id: k.id,
    name: k.name,
    type: k.type,
    capacity: k.capacity || 1,
  };
}

export function mapSupabaseToKennel(row: any): Kennel {
  return {
    id: row.id,
    name: row.name,
    type: row.type as KennelType,
    capacity: row.capacity,
  };
}

export function mapAnimalToSupabase(
  a: Animal,
  existingUserIds?: Set<string>,
  existingSolIds?: Set<string>,
  existingTutorIds?: Set<string>
) {
  // Sanitiza Foreign Keys para que nunca violem restrições do Postgres
  const solId = cleanString(a.solicitanteId);
  const tutorId = cleanString(a.tutorId);
  const userRespId = cleanString(a.usuarioResponsavelId);

  const validSolId = (existingSolIds && solId) ? (existingSolIds.has(solId) ? solId : null) : solId;
  const validTutorId = (existingTutorIds && tutorId) ? (existingTutorIds.has(tutorId) ? tutorId : null) : tutorId;
  const validUserRespId = (existingUserIds && userRespId) ? (existingUserIds.has(userRespId) ? userRespId : null) : (userRespId || null);

  return {
    id: a.id,
    nome: a.nome || 'Sem Nome',
    peso: typeof a.peso === 'number' ? a.peso : parseFloat(String(a.peso || 0)) || 0,
    idade: cleanString(a.idade),
    cor_pelagem: a.corPelagem || 'Não informada',
    especie: normalizeEspecie(a.especie),
    raca: cleanString(a.raca) || 'SRD',
    porte: normalizePorte(a.porte),
    sexo: normalizeSexo(a.sexo),
    castrado: !!a.castrado,
    microchipado: !!a.microchipado,
    numero_microchip: cleanString(a.numeroMicrochip),
    tem_tutor: !!a.temTutor,
    local_resgate: a.localResgate || 'Não informado',
    data_resgate: cleanString(a.dataResgate) || new Date().toISOString(),
    motivo: a.motivo || '',
    data_cadastro: cleanString(a.dataCadastro) || new Date().toISOString(),
    usuario_responsavel_id: validUserRespId,
    solicitante_id: validSolId,
    tutor_id: validTutorId,
    condicao: a.condicao || AnimalCondicao.ACOLHIDO,
    resgate_samuvet: !!a.resgateSamuvet,
    responsavel_samuvet: cleanString(a.responsavelSamuvet),
    foto: cleanString(a.foto),
    data_obito: cleanString(a.dataObito),
    causa_obito: cleanString(a.causaObito),
    data_soltura: cleanString(a.dataSoltura),
    local_soltura: cleanString(a.localSoltura),
    data_adocao: cleanString(a.dataAdocao),
    adotante_nome: a.adotante ? cleanString(a.adotante.nome) : null,
    adotante_cpf: a.adotante ? cleanString(a.adotante.cpf) : null,
    adotante_telefone: a.adotante ? cleanString(a.adotante.telefone) : null,
    necessita_internacao: !!a.necessitaInternacao,
    tipo_acomodacao_sugerida: a.tipoAcomodacaoSugerida || null,
    justificativa_internacao: cleanString(a.justificativaInternacao),
    data_internacao: cleanString(a.dataInternacao),
  };
}

export function mapSupabaseToAnimal(row: any): Animal {
  return {
    id: row.id,
    nome: row.nome,
    peso: Number(row.peso) || 0,
    idade: row.idade || undefined,
    corPelagem: row.cor_pelagem,
    especie: row.especie as Especie,
    raca: row.raca,
    porte: row.porte as Porte,
    sexo: row.sexo as Sexo,
    castrado: !!row.castrado,
    microchipado: !!row.microchipado,
    numeroMicrochip: row.numero_microchip || undefined,
    temTutor: !!row.tem_tutor,
    localResgate: row.local_resgate,
    dataResgate: row.data_resgate,
    motivo: row.motivo || '',
    dataCadastro: row.data_cadastro,
    usuarioResponsavelId: row.usuario_responsavel_id || '1',
    solicitanteId: row.solicitante_id || '',
    tutorId: row.tutor_id || undefined,
    condicao: row.condicao as AnimalCondicao,
    resgateSamuvet: !!row.resgate_samuvet,
    responsavelSamuvet: row.responsavel_samuvet || undefined,
    foto: row.foto || undefined,
    dataObito: row.data_obito || undefined,
    causaObito: row.causa_obito || undefined,
    dataSoltura: row.data_soltura || undefined,
    localSoltura: row.local_soltura || undefined,
    dataAdocao: row.data_adocao || undefined,
    adotante: row.adotante_nome ? {
      nome: row.adotante_nome,
      cpf: row.adotante_cpf || '',
      telefone: row.adotante_telefone || '',
    } : undefined,
    necessitaInternacao: !!row.necessita_internacao,
    tipoAcomodacaoSugerida: row.tipo_acomodacao_sugerida as KennelType || undefined,
    justificativaInternacao: row.justificativa_internacao || undefined,
    dataInternacao: row.data_internacao || undefined,
  };
}

export function mapOccupationToSupabase(occ: KennelOccupation) {
  return {
    id: occ.id,
    kennel_id: occ.kennelId,
    animal_id: occ.animalId,
    entry_date: cleanString(occ.entryDate) || new Date().toISOString(),
    exit_date: cleanString(occ.exitDate),
    vet_id: occ.vetId || '1',
    clinical_record_id: cleanString(occ.clinicalRecordId),
    justification: occ.justification || 'Acomodação inicial',
  };
}

export function mapSupabaseToOccupation(row: any): KennelOccupation {
  return {
    id: row.id,
    kennelId: row.kennel_id,
    animalId: row.animal_id,
    entryDate: row.entry_date,
    exitDate: row.exit_date || undefined,
    vetId: row.vet_id,
    clinicalRecordId: row.clinical_record_id || undefined,
    justification: row.justification,
  };
}

export function mapSurgeryToSupabase(
  s: AgendamentoCirurgia,
  existingUserIds?: Set<string>,
  existingAnimalIds?: Set<string>
) {
  const vetId = cleanString(s.veterinarioResponsavelId);
  const criadorId = cleanString(s.usuarioCriadorId) || '1';
  const validCriadorId = (existingUserIds && existingUserIds.has(criadorId)) ? criadorId : (existingUserIds?.values().next().value || '1');
  const validVetId = (existingUserIds && vetId && existingUserIds.has(vetId)) ? vetId : null;

  return {
    id: s.id,
    animal_id: s.animalId,
    data_agendada: s.dataAgendada || new Date().toISOString().split('T')[0],
    horario: cleanString(s.horario) || '08:00',
    turno: s.turno || 'MANHA',
    tipo_cirurgia: s.tipoCirurgia || 'Castração',
    status: s.status || CirurgiaStatus.AGENDADA,
    prioridade: s.prioridade || CirurgiaPrioridade.NORMAL,
    veterinario_responsavel_id: validVetId,
    veterinario_responsavel_nome: cleanString(s.veterinarioResponsavelNome),
    observacoes_pre_operatorias: cleanString(s.observacoesPreOperatorias),
    observacoes_pos_operatorias: cleanString(s.observacoesPosOperatorias),
    receitas_pos_operatorias: s.receitasPosOperatorias || [],
    data_realizacao: cleanString(s.dataRealizacao),
    realizada_por_id: (existingUserIds && s.realizadaPorId && existingUserIds.has(s.realizadaPorId)) ? s.realizadaPorId : null,
    realizada_por_nome: cleanString(s.realizadaPorNome),
    motivo_cancelamento: cleanString(s.motivoCancelamento),
    data_cadastro: cleanString(s.dataCadastro) || new Date().toISOString(),
    usuario_criador_id: validCriadorId,
  };
}

export function mapSupabaseToSurgery(row: any): AgendamentoCirurgia {
  return {
    id: row.id,
    animalId: row.animal_id,
    dataAgendada: row.data_agendada,
    horario: row.horario || undefined,
    turno: row.turno || 'MANHA',
    tipoCirurgia: row.tipo_cirurgia,
    status: row.status as CirurgiaStatus,
    prioridade: row.prioridade as CirurgiaPrioridade,
    veterinarioResponsavelId: row.veterinario_responsavel_id || undefined,
    veterinarioResponsavelNome: row.veterinario_responsavel_nome || undefined,
    observacoesPreOperatorias: row.observacoes_pre_operatorias || undefined,
    observacoesPosOperatorias: row.observacoes_pos_operatorias || undefined,
    receitasPosOperatorias: row.receitas_pos_operatorias || undefined,
    dataRealizacao: row.data_realizacao || undefined,
    realizadaPorId: row.realizada_por_id || undefined,
    realizadaPorNome: row.realizada_por_nome || undefined,
    motivoCancelamento: row.motivo_cancelamento || undefined,
    dataCadastro: row.data_cadastro,
    usuarioCriadorId: row.usuario_criador_id,
  };
}

export function mapRecordToSupabase(
  r: ClinicalRecord,
  existingUserIds?: Set<string>,
  existingAnimalIds?: Set<string>
) {
  const vetId = cleanString(r.veterinarioId) || '1';
  const validVetId = (existingUserIds && existingUserIds.has(vetId)) ? vetId : (existingUserIds?.values().next().value || '1');

  return {
    id: r.id,
    animal_id: r.animalId,
    veterinario_id: validVetId,
    data_atendimento: cleanString(r.dataAtendimento) || new Date().toISOString(),
    inativo: !!r.inativo,
    vacinas: cleanString(r.vacinas),
    parasitas: cleanString(r.parasitas),
    temperatura: cleanString(r.temperatura),
    peso: cleanString(r.peso),
    mucosa: cleanString(r.mucosa),
    palpacao_abdominal: cleanString(r.palpacaoAbdominal),
    hidratacao: cleanString(r.hidratacao),
    ausculta_cardiaca: cleanString(r.auscultaCardiaca),
    ausculta_pulmonar: cleanString(r.auscultaPulmonar),
    frequencia_cardiaca: cleanString(r.frequenciaCardiaca),
    frequencia_respiratoria: cleanString(r.frequenciaRespiratoria),
    observacoes_gerais: cleanString(r.observacoesGerais),
    exames_solicitados: cleanString(r.examesSolicitados),
    tratamento_ambulatorial: cleanString(r.tratamentoAmbulatorial),
    diagnostico_clinico: cleanString(r.diagnosticoClinico),
    status_resultante: r.statusResultante || AnimalCondicao.ACOLHIDO,
    data_obito: cleanString(r.dataObito),
    causa_obito: cleanString(r.causaObito),
    data_soltura: cleanString(r.dataSoltura),
    local_soltura: cleanString(r.localSoltura),
    recommended_kennel_type: r.recommendedKennelType || null,
    accommodation_justification: cleanString(r.accommodationJustification),
    necessita_internacao: !!r.necessitaInternacao,
    v10_aplicada: !!r.v10Aplicada,
    v10_data: cleanString(r.v10Data),
    antirrabica_aplicada: !!r.antirrabicaAplicada,
    antirrabica_data: cleanString(r.antirrabicaData),
    vermifugo_aplicado: !!r.vermifugoAplicado,
    vermifugo_data: cleanString(r.vermifugoData),
    microchip_aplicado: !!r.microchipAplicado,
    numero_microchip_aplicado: cleanString(r.numeroMicrochipAplicado),
  };
}

export function mapSupabaseToRecord(row: any): ClinicalRecord {
  return {
    id: row.id,
    animalId: row.animal_id,
    veterinarioId: row.veterinario_id,
    dataAtendimento: row.data_atendimento,
    inativo: !!row.inativo,
    vacinas: row.vacinas || '',
    parasitas: row.parasitas || '',
    temperatura: row.temperatura || '',
    peso: row.peso || '',
    mucosa: row.mucosa || '',
    palpacaoAbdominal: row.palpacao_abdominal || '',
    hidratacao: row.hidratacao || '',
    auscultaCardiaca: row.ausculta_cardiaca || '',
    auscultaPulmonar: row.ausculta_pulmonar || '',
    frequenciaCardiaca: row.frequencia_cardiaca || '',
    frequenciaRespiratoria: row.frequencia_respiratoria || '',
    observacoesGerais: row.observacoes_gerais || '',
    examesSolicitados: row.exames_solicitados || '',
    tratamentoAmbulatorial: row.tratamento_ambulatorial || '',
    diagnosticoClinico: row.diagnostico_clinico || '',
    receitas: [],
    statusResultante: row.status_resultante as AnimalCondicao,
    dataObito: row.data_obito || undefined,
    causaObito: row.causa_obito || undefined,
    dataSoltura: row.data_soltura || undefined,
    localSoltura: row.local_soltura || undefined,
    recommendedKennelType: row.recommended_kennel_type as KennelType || undefined,
    accommodationJustification: row.accommodation_justification || undefined,
    necessitaInternacao: !!row.necessita_internacao,
    v10Aplicada: !!row.v10_aplicada,
    v10Data: row.v10_data || undefined,
    antirrabicaAplicada: !!row.antirrabica_aplicada,
    antirrabicaData: row.antirrabica_data || undefined,
    vermifugoAplicado: !!row.vermifugo_aplicado,
    vermifugoData: row.vermifugo_data || undefined,
    microchipAplicado: !!row.microchip_aplicado,
    numeroMicrochipAplicado: row.numero_microchip_aplicado || undefined,
  };
}

export function mapUserToSupabase(u: any, credentialHash?: string | null) {
  const payload: any = {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    crmv: cleanString(u.crmv),
    matricula: cleanString(u.matricula),
    email: cleanString(u.email),
  };
  if (credentialHash !== undefined) {
    payload.uid = credentialHash;
  } else if (u.uid) {
    payload.uid = u.uid;
  }
  return payload;
}

export function mapSupabaseToUser(row: any): any {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    crmv: row.crmv || undefined,
    matricula: row.matricula || undefined,
    email: row.email || undefined,
    uid: row.uid || undefined,
  };
}

// ==============================================================================
// OPERAÇÕES INDIVIDUAIS DE SINCRONIZAÇÃO (Pushes em tempo real)
// ==============================================================================

export async function syncAnimalToSupabase(animal: Animal) {
  try {
    let validSolId: string | null = cleanString(animal.solicitanteId);
    let validTutorId: string | null = cleanString(animal.tutorId);
    let validUserId: string | null = cleanString(animal.usuarioResponsavelId);

    // 1. Garante que o solicitante exista no Supabase se houver solicitanteId
    if (validSolId) {
      const { data: solExists } = await supabase.from('solicitantes').select('id').eq('id', validSolId).maybeSingle();
      if (!solExists) {
        try {
          const localSolList = JSON.parse(localStorage.getItem('sisbem_solicitantes') || '[]');
          const localSol = localSolList.find((s: any) => s.id === validSolId);
          if (localSol) {
            const solPayload = mapSolicitanteToSupabase(localSol);
            const { error: solErr } = await supabase.from('solicitantes').upsert([solPayload]);
            if (solErr) {
              console.warn('Solicitante não pôde ser sincronizado:', solErr.message);
              validSolId = null;
            }
          } else {
            validSolId = null;
          }
        } catch {
          validSolId = null;
        }
      }
    }

    // 2. Garante que o tutor exista no Supabase se houver tutorId
    if (validTutorId) {
      const { data: tutExists } = await supabase.from('tutores').select('id').eq('id', validTutorId).maybeSingle();
      if (!tutExists) {
        try {
          const localTutList = JSON.parse(localStorage.getItem('sisbem_tutores') || '[]');
          const localTut = localTutList.find((t: any) => t.id === validTutorId);
          if (localTut) {
            const tutPayload = mapTutorToSupabase(localTut);
            const { error: tutErr } = await supabase.from('tutores').upsert([tutPayload]);
            if (tutErr) {
              console.warn('Tutor não pôde ser sincronizado:', tutErr.message);
              validTutorId = null;
            }
          } else {
            validTutorId = null;
          }
        } catch {
          validTutorId = null;
        }
      }
    }

    // 3. Verifica se usuarioResponsavelId existe em users no Supabase
    if (validUserId) {
      const { data: userExists } = await supabase.from('users').select('id').eq('id', validUserId).maybeSingle();
      if (!userExists) {
        validUserId = null;
      }
    }

    const payload = {
      id: animal.id,
      nome: animal.nome || 'Sem Nome',
      peso: typeof animal.peso === 'number' ? animal.peso : parseFloat(String(animal.peso || 0)) || 0,
      idade: cleanString(animal.idade),
      cor_pelagem: animal.corPelagem || 'Não informada',
      especie: normalizeEspecie(animal.especie),
      raca: cleanString(animal.raca) || 'SRD',
      porte: normalizePorte(animal.porte),
      sexo: normalizeSexo(animal.sexo),
      castrado: !!animal.castrado,
      microchipado: !!animal.microchipado,
      numero_microchip: cleanString(animal.numeroMicrochip),
      tem_tutor: !!animal.temTutor,
      local_resgate: animal.localResgate || 'Não informado',
      data_resgate: cleanString(animal.dataResgate) || new Date().toISOString(),
      motivo: animal.motivo || '',
      data_cadastro: cleanString(animal.dataCadastro) || new Date().toISOString(),
      usuario_responsavel_id: validUserId,
      solicitante_id: validSolId,
      tutor_id: validTutorId,
      condicao: animal.condicao || AnimalCondicao.ACOLHIDO,
      resgate_samuvet: !!animal.resgateSamuvet,
      responsavel_samuvet: cleanString(animal.responsavelSamuvet),
      foto: cleanString(animal.foto),
      data_obito: cleanString(animal.dataObito),
      causa_obito: cleanString(animal.causaObito),
      data_soltura: cleanString(animal.dataSoltura),
      local_soltura: cleanString(animal.localSoltura),
      data_adocao: cleanString(animal.dataAdocao),
      adotante_nome: animal.adotante ? cleanString(animal.adotante.nome) : null,
      adotante_cpf: animal.adotante ? cleanString(animal.adotante.cpf) : null,
      adotante_telefone: animal.adotante ? cleanString(animal.adotante.telefone) : null,
      necessita_internacao: !!animal.necessitaInternacao,
      tipo_acomodacao_sugerida: animal.tipoAcomodacaoSugerida || null,
      justificativa_internacao: cleanString(animal.justificativaInternacao),
      data_internacao: cleanString(animal.dataInternacao),
    };

    const { error } = await supabase.from('animals').upsert([payload]);
    if (error) {
      console.error('Supabase syncAnimal error:', error.message, error);
      return false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed', {
        detail: { action: 'saved', animal }
      }));
    }

    return true;
  } catch (err) {
    console.error('Supabase syncAnimal exception:', err);
    return false;
  }
}

export async function deleteAnimalFromSupabase(animalId: string) {
  try {
    const { error } = await supabase.from('animals').delete().eq('id', animalId);
    if (error) {
      console.warn('Erro ao deletar animal no Supabase:', error.message);
      return false;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed', {
        detail: { action: 'deleted', animalId }
      }));
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function syncSolicitanteToSupabase(solicitante: Solicitante) {
  try {
    const payload = mapSolicitanteToSupabase(solicitante);
    const { error } = await supabase.from('solicitantes').upsert([payload]);
    if (error) {
      console.warn('Supabase syncSolicitante error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteSolicitanteFromSupabase(id: string) {
  try {
    await supabase.from('solicitantes').delete().eq('id', id);
    return true;
  } catch (err) {
    return false;
  }
}

export async function syncTutorToSupabase(tutor: Tutor) {
  try {
    const payload = mapTutorToSupabase(tutor);
    const { error } = await supabase.from('tutores').upsert([payload]);
    if (error) {
      console.warn('Supabase syncTutor error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteTutorFromSupabase(id: string) {
  try {
    await supabase.from('tutores').delete().eq('id', id);
    return true;
  } catch (err) {
    return false;
  }
}

export async function syncSurgeryToSupabase(surgery: AgendamentoCirurgia) {
  try {
    // Primeiro garante que o animal existe no Supabase
    const payload = mapSurgeryToSupabase(surgery);
    const { error } = await supabase.from('surgeries').upsert([payload]);
    if (error) {
      console.warn('Supabase syncSurgery error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteSurgeryFromSupabase(id: string) {
  try {
    await supabase.from('surgeries').delete().eq('id', id);
    return true;
  } catch (err) {
    return false;
  }
}

export async function syncRecordToSupabase(record: ClinicalRecord) {
  try {
    const payload = mapRecordToSupabase(record);
    const { error } = await supabase.from('clinical_records').upsert([payload]);
    if (error) {
      console.warn('Supabase syncRecord error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteRecordFromSupabase(id: string) {
  try {
    await supabase.from('clinical_records').delete().eq('id', id);
    return true;
  } catch (err) {
    return false;
  }
}

export async function syncKennelToSupabase(kennel: Kennel) {
  try {
    const payload = mapKennelToSupabase(kennel);
    const { error } = await supabase.from('kennels').upsert([payload]);
    return !error;
  } catch (err) {
    return false;
  }
}

export async function syncOccupationToSupabase(occupation: KennelOccupation): Promise<boolean> {
  try {
    // 1. Prevenção de FK: Garantir que o animal existe no Supabase
    let validAnimalId = occupation.animalId;
    const { data: animalExists } = await supabase.from('animals').select('id').eq('id', validAnimalId).single();
    if (!animalExists) {
      const localAnimals: Animal[] = JSON.parse(localStorage.getItem('sisbem_animals') || '[]');
      const foundAnimal = localAnimals.find(a => a.id === validAnimalId);
      if (foundAnimal) {
        await syncAnimalToSupabase(foundAnimal);
      }
    }

    // 2. Prevenção de FK: Garantir que a baia existe no Supabase
    let validKennelId = occupation.kennelId;
    const { data: kennelExists } = await supabase.from('kennels').select('id').eq('id', validKennelId).single();
    if (!kennelExists) {
      const localKennels: Kennel[] = JSON.parse(localStorage.getItem('sisbem_kennels') || '[]');
      const foundKennel = localKennels.find(k => k.id === validKennelId);
      if (foundKennel) {
        const { data: sameNameKennel } = await supabase.from('kennels').select('id').eq('name', foundKennel.name).limit(1).single();
        if (sameNameKennel?.id) {
          validKennelId = sameNameKennel.id;
          occupation.kennelId = validKennelId;
        } else {
          await supabase.from('kennels').upsert([mapKennelToSupabase(foundKennel)]);
        }
      }
    }

    const payload = mapOccupationToSupabase({
      ...occupation,
      kennelId: validKennelId
    });

    const { error } = await supabase.from('kennel_occupations').upsert([payload]);
    if (error) {
      console.warn('Supabase syncOccupation error:', error.message, error);
      return false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-occupations-changed', {
        detail: { action: 'saved', occupation }
      }));
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));
    }

    return true;
  } catch (err) {
    console.warn('Supabase syncOccupation exception:', err);
    return false;
  }
}

export async function deleteOccupationFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('kennel_occupations').delete().eq('id', id);
    if (!error && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-occupations-changed', {
        detail: { action: 'deleted', id }
      }));
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));
    }
    return !error;
  } catch (err) {
    return false;
  }
}

export async function syncUserToSupabase(user: any) {
  try {
    let credHash = user.uid || null;
    if (!credHash && user.password) {
      credHash = await hashPassword(user.password, user.id);
    }
    const payload = mapUserToSupabase(user, credHash);
    const { error } = await supabase.from('users').upsert([payload]);
    if (error) {
      console.warn('Supabase syncUser info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteUserFromSupabase(id: string) {
  try {
    await supabase.from('users').delete().eq('id', id);
    return true;
  } catch (err) {
    return false;
  }
}

export async function syncKennelConfigsToSupabase(configs: KennelConfig[]): Promise<boolean> {
  try {
    const payload = {
      id: 'system-configs-v1',
      nome_completo: 'Configurações do Sistema (SISBEM)',
      cpf: 'CONFIG-SYSTEM',
      telefone: '0000',
      tipo: 'ORGAO_PUBLICO',
      observacoes: JSON.stringify(configs),
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('solicitantes').upsert([payload]);
    if (error) {
      console.warn('Supabase syncKennelConfigs aviso:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Erro syncKennelConfigsToSupabase:', err);
    return false;
  }
}

export async function syncKennelsFullToSupabase(kennels: Kennel[]): Promise<boolean> {
  try {
    if (!kennels || kennels.length === 0) return true;

    // 1. Mapeia e insere/atualiza todas as baias no Supabase em lotes
    const payload = kennels.map(mapKennelToSupabase);
    for (let i = 0; i < payload.length; i += 50) {
      const batch = payload.slice(i, i + 50);
      const { error } = await supabase.from('kennels').upsert(batch);
      if (error) {
        console.warn('Erro ao salvar lote de baias no Supabase:', error.message);
      }
    }

    // 2. Busca os IDs remotos para remover as que foram excluídas (redução de quantidade)
    const { data: remoteKennels } = await supabase.from('kennels').select('id');
    if (remoteKennels && remoteKennels.length > 0) {
      const localIds = new Set(kennels.map(k => k.id));
      const toDelete = remoteKennels.map((rk: any) => rk.id).filter(id => !localIds.has(id));
      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 50) {
          const delBatch = toDelete.slice(i, i + 50);
          await supabase.from('kennels').delete().in('id', delBatch);
        }
      }
    }

    return true;
  } catch (err) {
    console.warn('Erro syncKennelsFullToSupabase:', err);
    return false;
  }
}

// ==============================================================================
// SINCRONIZAÇÃO COMPLETA BIDIRECIONAL
// ==============================================================================

/**
 * Envia todos os dados locais do SISBEM para o banco de dados do Supabase.
 * Ordem estrita para respeitar chaves estrangeiras:
 * 1. Solicitantes, Tutores, Kennels, Usuários
 * 2. Animais
 * 3. Prontuários, Cirurgias, Ocupações de Baias
 */
export async function syncAllLocalDataToSupabase(dbInstance: any): Promise<{
  success: boolean;
  counts: SyncStats['counts'];
  errors: string[];
}> {
  updateSyncState({ status: 'syncing', lastError: null });
  const errors: string[] = [];
  const counts: SyncStats['counts'] = {
    animals: 0,
    solicitantes: 0,
    tutores: 0,
    kennels: 0,
    occupations: 0,
    surgeries: 0,
    records: 0,
    users: 0,
  };

  try {
    // 1. Kennels
    const localKennels: Kennel[] = dbInstance.getKennels() || [];
    if (localKennels.length > 0) {
      const payload = localKennels.map(mapKennelToSupabase);
      const { error } = await supabase.from('kennels').upsert(payload);
      if (error) errors.push(`Baias: ${error.message}`);
      else counts.kennels = localKennels.length;
    }

    // 2. Solicitantes
    const localSol: Solicitante[] = dbInstance.getSolicitantes() || [];
    if (localSol.length > 0) {
      const payload = localSol.map(mapSolicitanteToSupabase);
      const { error } = await supabase.from('solicitantes').upsert(payload);
      if (error) errors.push(`Solicitantes: ${error.message}`);
      else counts.solicitantes = localSol.length;
    }

    // 3. Tutores
    const localTutores: Tutor[] = dbInstance.getTutores() || [];
    if (localTutores.length > 0) {
      const payload = localTutores.map(mapTutorToSupabase);
      const { error } = await supabase.from('tutores').upsert(payload);
      if (error) errors.push(`Tutores: ${error.message}`);
      else counts.tutores = localTutores.length;
    }

    // 4. Usuários (tenta sincronizar; se houver RLS restrita na tabela users, registra aviso)
    const localUsers: User[] = dbInstance.getUsers() || [];
    let existingUserIds = new Set<string>();
    try {
      const { data: remoteUsers } = await supabase.from('users').select('id');
      if (remoteUsers && remoteUsers.length > 0) {
        existingUserIds = new Set(remoteUsers.map((u: any) => u.id));
      }
    } catch (e) {
      // Ignore
    }

    if (localUsers.length > 0) {
      const payload = await Promise.all(localUsers.map(async (u: any) => {
        let credHash = u.uid || null;
        if (!credHash && u.password) {
          credHash = await hashPassword(u.password, u.id);
        }
        return mapUserToSupabase(u, credHash);
      }));
      const { error } = await supabase.from('users').upsert(payload);
      if (error) {
        // Se violar RLS da tabela users, não trava a sincronização dos animais
        console.warn('Aviso ao sincronizar usuários com Supabase:', error.message);
      } else {
        counts.users = localUsers.length;
        localUsers.forEach(u => existingUserIds.add(u.id));
      }
    }

    // 5. Animais
    const { data: remoteSol } = await supabase.from('solicitantes').select('id');
    const existingSolIds = new Set([
      ...localSol.map(s => s.id),
      ...(remoteSol || []).map((s: any) => s.id)
    ]);
    const { data: remoteTut } = await supabase.from('tutores').select('id');
    const existingTutorIds = new Set([
      ...localTutores.map(t => t.id),
      ...(remoteTut || []).map((t: any) => t.id)
    ]);
    const localAnimals: Animal[] = dbInstance.getAnimals() || [];
    
    if (localAnimals.length > 0) {
      const payload = localAnimals.map(a => mapAnimalToSupabase(a, existingUserIds, existingSolIds, existingTutorIds));
      const { error } = await supabase.from('animals').upsert(payload);
      if (error) {
        errors.push(`Animais: ${error.message}`);
      } else {
        counts.animals = localAnimals.length;
      }
    }

    // 6. Ocupações de Baias
    const localOcc: KennelOccupation[] = dbInstance.getOccupations() || [];
    if (localOcc.length > 0 && counts.animals > 0) {
      const validOcc = localOcc.filter(o => localAnimals.some(a => a.id === o.animalId));
      if (validOcc.length > 0) {
        const payload = validOcc.map(mapOccupationToSupabase);
        const { error } = await supabase.from('kennel_occupations').upsert(payload);
        if (error) errors.push(`Ocupações: ${error.message}`);
        else counts.occupations = validOcc.length;
      }
    }

    // 7. Cirurgias (se houver usuário criador válido no Supabase)
    const localCirurgias: AgendamentoCirurgia[] = dbInstance.getCirurgias() || [];
    if (localCirurgias.length > 0 && counts.animals > 0) {
      const validCirurgias = localCirurgias.filter(c => localAnimals.some(a => a.id === c.animalId));
      if (validCirurgias.length > 0) {
        const payload = validCirurgias.map(c => mapSurgeryToSupabase(c, existingUserIds));
        const { error } = await supabase.from('surgeries').upsert(payload);
        if (error) {
          console.warn('Aviso Cirurgias no Supabase:', error.message);
          errors.push(`Cirurgias: ${error.message}`);
        } else {
          counts.surgeries = validCirurgias.length;
        }
      }
    }

    // 8. Prontuários Clínicos
    const localRecords: ClinicalRecord[] = dbInstance.getRecords() || [];
    if (localRecords.length > 0 && counts.animals > 0) {
      const validRecords = localRecords.filter(r => localAnimals.some(a => a.id === r.animalId));
      if (validRecords.length > 0) {
        const payload = validRecords.map(r => mapRecordToSupabase(r, existingUserIds));
        const { error } = await supabase.from('clinical_records').upsert(payload);
        if (error) {
          console.warn('Aviso Prontuários no Supabase:', error.message);
          errors.push(`Prontuários: ${error.message}`);
        } else {
          counts.records = validRecords.length;
        }
      }
    }

    const now = new Date().toISOString();
    updateSyncState({
      status: errors.length === 0 ? 'success' : 'error',
      lastSyncAt: now,
      lastError: errors.length > 0 ? errors.join('; ') : null,
      counts,
    });

    return {
      success: errors.length === 0,
      counts,
      errors,
    };
  } catch (err: any) {
    const msg = err?.message || 'Erro inesperado na sincronização';
    errors.push(msg);
    updateSyncState({
      status: 'error',
      lastSyncAt: new Date().toISOString(),
      lastError: msg,
      counts,
    });
    return {
      success: false,
      counts,
      errors,
    };
  }
}

export type SyncModule = 'animals' | 'solicitantes' | 'tutores' | 'surgeries' | 'users' | 'kennels' | 'occupations' | 'configs';

export interface PullOptions {
  modules?: SyncModule[];
  force?: boolean;
}

// Controle de Cache e Throttling no Frontend para Redução Drástica de Egress
const moduleCacheTimestamps: Partial<Record<SyncModule, number>> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache em memória
let inFlightPullPromise: Promise<{
  success: boolean;
  syncedCounts: Partial<SyncStats['counts']>;
}> | null = null;

/**
 * Puxa dados do Supabase e mescla com o armazenamento local
 * Otimizado: seleciona apenas as colunas necessárias, exclui fotos pesadas em base64 da busca geral,
 * respeita cache de 5 minutos e reutiliza requisições em voo (in-flight deduplication).
 */
export async function pullFromSupabaseToLocal(
  dbInstance?: any,
  options?: PullOptions
): Promise<{
  success: boolean;
  syncedCounts: Partial<SyncStats['counts']>;
}> {
  // Deduplicação de requisições paralelas idênticas
  if (inFlightPullPromise && !options?.force) {
    return inFlightPullPromise;
  }

  const execPull = async () => {
    try {
      const now = Date.now();
      const isForce = !!options?.force;
      const requestedModules = options?.modules || [
        'configs',
        'solicitantes',
        'tutores',
        'animals',
        'surgeries',
        'users',
        'kennels',
        'occupations'
      ];

      const shouldSync = (mod: SyncModule) => {
        if (!requestedModules.includes(mod)) return false;
        if (isForce) return true;
        const lastSync = moduleCacheTimestamps[mod] || 0;
        return (now - lastSync) > CACHE_TTL_MS;
      };

      const syncedCounts: Partial<SyncStats['counts']> = {};

      // 0. Configurações de Baias e Sistema
      if (shouldSync('configs')) {
        try {
          const { data: configRow } = await supabase
            .from('solicitantes')
            .select('observacoes')
            .eq('id', 'system-configs-v1')
            .maybeSingle();

          if (configRow?.observacoes) {
            const parsedConfigs = JSON.parse(configRow.observacoes);
            if (Array.isArray(parsedConfigs) && parsedConfigs.length > 0) {
              localStorage.setItem('sisbem_kennel_configs', JSON.stringify(parsedConfigs));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sisbem-settings-changed', {
                  detail: { configs: parsedConfigs, source: 'supabase-pull' }
                }));
              }
            }
          }
          moduleCacheTimestamps.configs = now;
        } catch (e) {
          console.warn('Aviso ao puxar configurações de baias:', e);
        }
      }

      // 1. Solicitantes (apenas colunas necessárias, sem SELECT *)
      if (shouldSync('solicitantes')) {
        const { data: remSol } = await supabase
          .from('solicitantes')
          .select('id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes');

        if (remSol && remSol.length > 0) {
          const localSol = (dbInstance && typeof dbInstance.getSolicitantes === 'function')
            ? dbInstance.getSolicitantes()
            : JSON.parse(localStorage.getItem('sisbem_solicitantes') || '[]');
          const map = new Map<string, Solicitante>();
          localSol.forEach((s: Solicitante) => {
            if (s.id !== 'system-configs-v1' && !s.id.startsWith('__sys_')) map.set(s.id, s);
          });
          remSol
            .filter((r: any) => r.id !== 'system-configs-v1' && !r.id.startsWith('__sys_'))
            .forEach((r: any) => map.set(r.id, mapSupabaseToSolicitante(r)));
          const merged = Array.from(map.values());
          localStorage.setItem('sisbem_solicitantes', JSON.stringify(merged));
          syncedCounts.solicitantes = merged.length;
        }
        moduleCacheTimestamps.solicitantes = now;
      }

      // 2. Tutores (apenas colunas necessárias, sem SELECT *)
      if (shouldSync('tutores')) {
        const { data: remTutores } = await supabase
          .from('tutores')
          .select('id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro');

        if (remTutores && remTutores.length > 0) {
          const localTut = (dbInstance && typeof dbInstance.getTutores === 'function')
            ? dbInstance.getTutores()
            : JSON.parse(localStorage.getItem('sisbem_tutores') || '[]');
          const map = new Map<string, Tutor>();
          localTut.forEach((t: Tutor) => map.set(t.id, t));
          remTutores.forEach((r: any) => map.set(r.id, mapSupabaseToTutor(r)));
          const merged = Array.from(map.values());
          localStorage.setItem('sisbem_tutores', JSON.stringify(merged));
          syncedCounts.tutores = merged.length;
        }
        moduleCacheTimestamps.tutores = now;
      }

      // 3. Animais (Cache local leve: apenas 30 mais recentes, sem Base64 no localStorage)
      if (shouldSync('animals')) {
        const { data: remAnimals, error: animErr } = await supabase
          .from('animals')
          .select('id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo, castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate, motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id, condicao, resgate_samuvet, responsavel_samuvet, data_obito, causa_obito, data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone, necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao')
          .order('data_cadastro', { ascending: false })
          .limit(30);

        if (!animErr && remAnimals && remAnimals.length > 0) {
          const mapped = remAnimals.map(mapSupabaseToAnimal);
          safeSetLocalAnimals(mapped);
          syncedCounts.animals = mapped.length;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sisbem-animals-changed', {
              detail: { source: 'supabase-pull', count: mapped.length }
            }));
          }
        }
        moduleCacheTimestamps.animals = now;
      }

      // 4. Cirurgias (apenas colunas necessárias, sem SELECT *)
      if (shouldSync('surgeries')) {
        const { data: remCirurgias } = await supabase
          .from('surgeries')
          .select('id, animal_id, data_agendada, horario, turno, tipo_cirurgia, status, prioridade, veterinario_responsavel_id, veterinario_responsavel_nome, observacoes_pre_operatorias, observacoes_pos_operatorias, receitas_pos_operatorias, data_realizacao, realizada_por_id, realizada_por_nome, motivo_cancelamento, data_cadastro, usuario_criador_id');

        if (remCirurgias && remCirurgias.length > 0) {
          const localCir = (dbInstance && typeof dbInstance.getCirurgias === 'function')
            ? dbInstance.getCirurgias()
            : JSON.parse(localStorage.getItem('sisbem_cirurgias') || '[]');
          const map = new Map<string, AgendamentoCirurgia>();
          localCir.forEach((c: AgendamentoCirurgia) => map.set(c.id, c));
          remCirurgias.forEach((r: any) => map.set(r.id, mapSupabaseToSurgery(r)));
          const merged = Array.from(map.values());
          localStorage.setItem('sisbem_cirurgias', JSON.stringify(merged));
          syncedCounts.surgeries = merged.length;
        }
        moduleCacheTimestamps.surgeries = now;
      }

      // 5. Usuários (apenas colunas necessárias, sem SELECT *)
      if (shouldSync('users')) {
        const { data: remUsers } = await supabase
          .from('users')
          .select('id, name, username, role, crmv, matricula, email, uid');

        if (remUsers && remUsers.length > 0) {
          const localUsers = (dbInstance && typeof dbInstance.getUsers === 'function')
            ? (dbInstance.getUsers() || [])
            : JSON.parse(localStorage.getItem('sisbem_users') || '[]');
          const map = new Map<string, any>();
          localUsers.forEach((u: any) => map.set(u.id, u));
          remUsers.forEach((r: any) => {
            const existing = map.get(r.id);
            map.set(r.id, {
              id: r.id,
              name: r.name,
              username: r.username,
              role: r.role,
              crmv: r.crmv || undefined,
              matricula: r.matricula || undefined,
              email: r.email || undefined,
              uid: r.uid || undefined,
              password: existing?.password || undefined,
            });
          });
          const merged = Array.from(map.values());
          localStorage.setItem('sisbem_users', JSON.stringify(merged));
          syncedCounts.users = merged.length;
        }
        moduleCacheTimestamps.users = now;
      }

      // 6. Baias (Kennels) (apenas colunas necessárias, sem SELECT *)
      if (shouldSync('kennels')) {
        const { data: remKennels } = await supabase
          .from('kennels')
          .select('id, name, type, capacity');

        if (remKennels && remKennels.length > 0) {
          const raw = remKennels.map(mapSupabaseToKennel);
          const seen = new Set<string>();
          const merged: Kennel[] = [];
          for (const k of raw) {
            if (!k || !k.id || !k.name) continue;
            const key = `${(k.type || '').trim().toLowerCase()}::${k.name.trim().toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(k);
            }
          }
          localStorage.setItem('sisbem_kennels', JSON.stringify(merged));
          syncedCounts.kennels = merged.length;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sisbem-kennels-changed', {
              detail: { source: 'supabase-pull', count: merged.length }
            }));
            window.dispatchEvent(new CustomEvent('sisbem-occupations-changed'));
          }
        }
        moduleCacheTimestamps.kennels = now;
      }

      // 7. Ocupações de Baias (apenas colunas necessárias, sem SELECT *)
      if (shouldSync('occupations')) {
        const { data: remOccs } = await supabase
          .from('kennel_occupations')
          .select('id, kennel_id, animal_id, entry_date, exit_date, vet_id, clinical_record_id, justification');

        if (remOccs) {
          const localOccs = (dbInstance && typeof dbInstance.getOccupations === 'function')
            ? dbInstance.getOccupations()
            : JSON.parse(localStorage.getItem('sisbem_occupations') || '[]');
          const map = new Map<string, KennelOccupation>();
          localOccs.forEach((o: KennelOccupation) => map.set(o.id, o));
          remOccs.forEach((r: any) => map.set(r.id, mapSupabaseToOccupation(r)));
          const merged = Array.from(map.values());
          localStorage.setItem('sisbem_occupations', JSON.stringify(merged));
          syncedCounts.occupations = merged.length;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sisbem-occupations-changed', {
              detail: { source: 'supabase-pull', count: merged.length }
            }));
            window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));
          }
        }
        moduleCacheTimestamps.occupations = now;
      }

      return { success: true, syncedCounts };
    } catch (err) {
      console.warn('Erro ao puxar dados do Supabase:', err);
      return { success: false, syncedCounts: {} };
    } finally {
      inFlightPullPromise = null;
    }
  };

  inFlightPullPromise = execPull();
  return inFlightPullPromise;
}

/**
 * Carrega a foto de um animal sob demanda caso ainda não esteja em cache local.
 * Evita o download desnecessário de imagens em Base64 durante listagens e navegação comum.
 */
export async function ensureAnimalPhoto(animalId: string): Promise<string | null> {
  try {
    const localAnimals: Animal[] = JSON.parse(localStorage.getItem('sisbem_animals') || '[]');
    const existing = localAnimals.find(a => a.id === animalId);
    if (existing?.foto && !isBase64Photo(existing.foto)) return existing.foto;

    const { data, error } = await supabase
      .from('animals')
      .select('foto')
      .eq('id', animalId)
      .maybeSingle();

    if (!error && data?.foto) {
      // Se for URL do Supabase Storage / CDN (não Base64), pode salvar no cache local com segurança
      if (!isBase64Photo(data.foto) && existing) {
        existing.foto = data.foto;
        safeSetLocalAnimals(localAnimals);
      }
      // Se for foto em Base64 legada, retorna em memória para renderizar a tela, mas NUNCA grava Base64 no localStorage!
      return data.foto;
    }
  } catch (e) {
    console.warn('Erro ao carregar foto sob demanda:', e);
  }
  return null;
}

export function syncLocalKennelsWithConfigs(configs: KennelConfig[]) {
  try {
    const rawKennels: Kennel[] = JSON.parse(localStorage.getItem('sisbem_kennels') || '[]');
    const occupations: KennelOccupation[] = JSON.parse(localStorage.getItem('sisbem_occupations') || '[]');
    const activeOccKennelIds = new Set(occupations.filter(o => !o.exitDate).map(o => o.kennelId));

    const newKennels: Kennel[] = [];

    configs.forEach(cfg => {
      const currentByType = rawKennels.filter(k => k.type === cfg.type);
      const byName = new Map<string, Kennel>();
      currentByType.forEach(k => {
        const key = k.name.trim().toLowerCase();
        if (!byName.has(key) || activeOccKennelIds.has(k.id)) {
          byName.set(key, k);
        }
      });

      for (let i = 1; i <= cfg.count; i++) {
        const expectedName = `${cfg.type} ${i.toString().padStart(2, '0')}`;
        const key = expectedName.toLowerCase();
        const existing = byName.get(key);

        if (existing) {
          newKennels.push({
            ...existing,
            name: expectedName,
            capacity: cfg.capacity
          });
        } else {
          newKennels.push({
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `k-${cfg.type.toLowerCase().replace(/[^a-z0-9]/g, '')}-${i}`,
            name: expectedName,
            type: cfg.type,
            capacity: cfg.capacity
          });
        }
      }
    });

    localStorage.setItem('sisbem_kennels', JSON.stringify(newKennels));
  } catch (e) {
    console.warn('Erro ao sincronizar baias locais com configs:', e);
  }
}

let realtimeChannel: any = null;
let realtimeInitialized = false;

/**
 * Inicializa a escuta em tempo real (Realtime Channel) do Supabase apenas para tabelas operacionais críticas.
 * Atualiza registros pontuais em memória sem disparar re-consultas totais do banco.
 * NÃO utiliza polling periódica nem re-consultas ao focar na janela.
 */
export function initRealtimeSync(onUpdate?: (table: string, payload: any) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (realtimeInitialized && realtimeChannel) return () => {};

  realtimeInitialized = true;

  try {
    realtimeChannel = supabase.channel('sisbem-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animals' },
        (payload: any) => {
          try {
            const localAnimals: Animal[] = JSON.parse(localStorage.getItem('sisbem_animals') || '[]');
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const mapped = mapSupabaseToAnimal(payload.new);
              const idx = localAnimals.findIndex(a => a.id === mapped.id);
              if (idx > -1) {
                // Preserva foto se payload não trouxe foto nova e se não for base64
                if (!mapped.foto && localAnimals[idx].foto) {
                  mapped.foto = localAnimals[idx].foto;
                }
                localAnimals[idx] = mapped;
              } else {
                localAnimals.unshift(mapped);
              }
              safeSetLocalAnimals(localAnimals);
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                const filtered = localAnimals.filter(a => a.id !== deletedId);
                safeSetLocalAnimals(filtered);
              }
            }

            window.dispatchEvent(new CustomEvent('sisbem-animals-changed', {
              detail: { type: payload.eventType, data: payload }
            }));

            if (onUpdate) onUpdate('animals', payload);
          } catch (e) {
            console.warn('Erro ao processar realtime de animais:', e);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kennel_occupations' },
        (payload: any) => {
          try {
            const list: KennelOccupation[] = JSON.parse(localStorage.getItem('sisbem_occupations') || '[]');
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const mapped = mapSupabaseToOccupation(payload.new);
              const idx = list.findIndex(o => o.id === mapped.id);
              if (idx > -1) list[idx] = mapped;
              else list.push(mapped);
              localStorage.setItem('sisbem_occupations', JSON.stringify(list));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                localStorage.setItem('sisbem_occupations', JSON.stringify(list.filter(o => o.id !== deletedId)));
              }
            }

            window.dispatchEvent(new CustomEvent('sisbem-occupations-changed', {
              detail: { type: payload.eventType, data: payload }
            }));
            window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));

            if (onUpdate) onUpdate('kennel_occupations', payload);
          } catch (e) {
            console.warn('Erro ao processar realtime de ocupações de baias:', e);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Erro ao inicializar canal realtime Supabase:', err);
  }

  // Cleanup: cancela a assinatura realtime. Sem polling e sem listeners de focus.
  return () => {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
    realtimeInitialized = false;
  };
}
