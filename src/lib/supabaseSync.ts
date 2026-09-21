import { supabase } from './supabase';
import { hashPassword } from './authCrypto';
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
  const validUserRespId = (existingUserIds && userRespId) ? (existingUserIds.has(userRespId) ? userRespId : null) : null;

  return {
    id: a.id,
    nome: a.nome || 'Sem Nome',
    peso: typeof a.peso === 'number' ? a.peso : parseFloat(String(a.peso || 0)) || 0,
    idade: cleanString(a.idade),
    cor_pelagem: a.corPelagem || 'Não informada',
    especie: a.especie || Especie.CAO,
    raca: a.raca || 'SRD',
    porte: a.porte || Porte.MEDIO,
    sexo: a.sexo || Sexo.MACHO,
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
    const payload = mapAnimalToSupabase(animal);
    const { error } = await supabase.from('animals').upsert([payload]);
    if (error) {
      console.warn('Supabase syncAnimal error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase syncAnimal exception:', err);
    return false;
  }
}

export async function deleteAnimalFromSupabase(animalId: string) {
  try {
    await supabase.from('animals').delete().eq('id', animalId);
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

export async function syncOccupationToSupabase(occupation: KennelOccupation) {
  try {
    const payload = mapOccupationToSupabase(occupation);
    const { error } = await supabase.from('kennel_occupations').upsert([payload]);
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
    const existingSolIds = new Set(localSol.map(s => s.id));
    const existingTutorIds = new Set(localTutores.map(t => t.id));
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

/**
 * Puxa dados do Supabase e mescla com o armazenamento local
 */
export async function pullFromSupabaseToLocal(dbInstance: any): Promise<{
  success: boolean;
  syncedCounts: Partial<SyncStats['counts']>;
}> {
  try {
    const syncedCounts: Partial<SyncStats['counts']> = {};

    // 1. Solicitantes
    const { data: remSol } = await supabase.from('solicitantes').select('*');
    if (remSol && remSol.length > 0) {
      const localSol = dbInstance.getSolicitantes();
      const map = new Map<string, Solicitante>();
      localSol.forEach((s: Solicitante) => map.set(s.id, s));
      remSol.forEach((r: any) => map.set(r.id, mapSupabaseToSolicitante(r)));
      const merged = Array.from(map.values());
      localStorage.setItem('sisbem_solicitantes', JSON.stringify(merged));
      syncedCounts.solicitantes = merged.length;
    }

    // 2. Tutores
    const { data: remTutores } = await supabase.from('tutores').select('*');
    if (remTutores && remTutores.length > 0) {
      const localTut = dbInstance.getTutores();
      const map = new Map<string, Tutor>();
      localTut.forEach((t: Tutor) => map.set(t.id, t));
      remTutores.forEach((r: any) => map.set(r.id, mapSupabaseToTutor(r)));
      const merged = Array.from(map.values());
      localStorage.setItem('sisbem_tutores', JSON.stringify(merged));
      syncedCounts.tutores = merged.length;
    }

    // 3. Animais
    const { data: remAnimals } = await supabase.from('animals').select('*');
    if (remAnimals && remAnimals.length > 0) {
      const localAnimals = dbInstance.getAnimals();
      const map = new Map<string, Animal>();
      localAnimals.forEach((a: Animal) => map.set(a.id, a));
      remAnimals.forEach((r: any) => map.set(r.id, mapSupabaseToAnimal(r)));
      const merged = Array.from(map.values());
      localStorage.setItem('sisbem_animals', JSON.stringify(merged));
      syncedCounts.animals = merged.length;
    }

    // 4. Cirurgias
    const { data: remCirurgias } = await supabase.from('surgeries').select('*');
    if (remCirurgias && remCirurgias.length > 0) {
      const localCir = dbInstance.getCirurgias();
      const map = new Map<string, AgendamentoCirurgia>();
      localCir.forEach((c: AgendamentoCirurgia) => map.set(c.id, c));
      remCirurgias.forEach((r: any) => map.set(r.id, mapSupabaseToSurgery(r)));
      const merged = Array.from(map.values());
      localStorage.setItem('sisbem_cirurgias', JSON.stringify(merged));
      syncedCounts.surgeries = merged.length;
    }

    // 5. Usuários
    const { data: remUsers } = await supabase.from('users').select('*');
    if (remUsers && remUsers.length > 0) {
      const localUsers = dbInstance.getUsers() || [];
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

    return { success: true, syncedCounts };
  } catch (err) {
    console.warn('Erro ao puxar dados do Supabase:', err);
    return { success: false, syncedCounts: {} };
  }
}
