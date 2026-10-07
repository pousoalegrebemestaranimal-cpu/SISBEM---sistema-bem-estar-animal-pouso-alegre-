import { supabase } from './supabase';
import { AnimalJoined, Solicitante, Tutor, AnimalCondicao, KennelOccupation, Kennel, ClinicalRecord, Prescription, Referral, ExamFile } from '../../types';
import { mapSupabaseToAnimal, mapSupabaseToTutor, mapSupabaseToSolicitante, mapSupabaseToRecord } from './supabaseSync';
import { db } from '../../services/db';

/**
 * Regra OFICIAL do SISBEM para determinar se uma ocupação de baia é ATIVA.
 * Uma ocupação é ATIVA se:
 * - o objeto existe;
 * - exitDate / exit_date for nulo, indefinido, vazio ou a string literal 'null'/'undefined'.
 */
export function isOccupationActive(occ?: { exitDate?: string | null; exit_date?: string | null } | null): boolean {
  if (!occ) return false;
  const exitVal = (occ as any).exitDate !== undefined ? (occ as any).exitDate : (occ as any).exit_date;
  if (!exitVal) return true;
  const trimmed = String(exitVal).trim();
  return trimmed === '' || trimmed === 'null' || trimmed === 'undefined';
}

/**
 * Retorna a ocupação ATIVA OFICIAL de um animal a partir de uma lista de ocupações.
 * Em caso de múltiplos registros ativos (inconsistência histórica),
 * seleciona sempre a de data de entrada (entryDate) mais recente.
 */
export function getActiveOccupation<T extends { exitDate?: string | null; entryDate?: string | null; animalId?: string; kennelId?: string; exit_date?: string | null; entry_date?: string | null; animal_id?: string; kennel_id?: string }>(
  list: T[],
  animalId?: string
): T | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const filtered = animalId ? list.filter(o => o && ((o as any).animalId === animalId || (o as any).animal_id === animalId)) : list;
  const activeList = filtered
    .filter(o => isOccupationActive(o))
    .sort((a, b) => {
      const entryA = (a as any).entryDate || (a as any).entry_date;
      const entryB = (b as any).entryDate || (b as any).entry_date;
      const timeA = entryA ? new Date(entryA).getTime() : 0;
      const timeB = entryB ? new Date(entryB).getTime() : 0;
      return timeB - timeA;
    });
  return activeList[0];
}

/**
 * Retorna todas as ocupações ATIVAS OFICIAIS de uma lista de ocupações,
 * garantindo que cada animal possua no máximo UMA ocupação ativa simultânea
 * (em caso de duplicidade residual, prioriza a de entryDate mais recente).
 */
export function getAllActiveOccupations<T extends { exitDate?: string | null; entryDate?: string | null; animalId?: string; kennelId?: string; exit_date?: string | null; entry_date?: string | null; animal_id?: string; kennel_id?: string }>(
  list: T[]
): T[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  const byAnimal = new Map<string, T[]>();
  for (const occ of list) {
    const aid = (occ as any)?.animalId || (occ as any)?.animal_id;
    if (!occ || !aid || !isOccupationActive(occ)) continue;
    const existing = byAnimal.get(aid);
    if (existing) {
      existing.push(occ);
    } else {
      byAnimal.set(aid, [occ]);
    }
  }
  const result: T[] = [];
  for (const [_, occs] of byAnimal.entries()) {
    occs.sort((a, b) => {
      const entryA = (a as any).entryDate || (a as any).entry_date;
      const entryB = (b as any).entryDate || (b as any).entry_date;
      const timeA = entryA ? new Date(entryA).getTime() : 0;
      const timeB = entryB ? new Date(entryB).getTime() : 0;
      return timeB - timeA;
    });
    result.push(occs[0]);
  }
  return result;
}

/**
 * Mapeia uma linha da tabela kennel_occupations do Supabase com join em kennels e animals
 */
export function mapRemoteOccupationWithKennel(r: any): KennelOccupation & { kennel?: Kennel; animal?: any; animals?: any } {
  const kennelData: Kennel | undefined = r.kennels ? {
    id: r.kennels.id,
    name: r.kennels.name,
    type: r.kennels.type,
    capacity: Number(r.kennels.capacity) || 1
  } : undefined;

  const animalData = r.animals ? {
    id: r.animals.id || r.animal_id,
    nome: r.animals.nome,
    especie: r.animals.especie,
    condicao: r.animals.condicao,
    temTutor: !!r.animals.tem_tutor
  } : undefined;

  return {
    id: r.id,
    kennelId: r.kennel_id,
    animalId: r.animal_id,
    entryDate: r.entry_date,
    exitDate: r.exit_date || undefined,
    vetId: r.vet_id,
    clinicalRecordId: r.clinical_record_id || undefined,
    justification: r.justification || '',
    kennel: kennelData,
    animal: animalData,
    animals: animalData
  };
}

/**
 * Consulta todas as ocupações registradas no Supabase com join nas baias (kennels) e animais.
 * Fonte canônica e oficial do sistema.
 */
export async function fetchAllOccupationsWithKennel(): Promise<Array<KennelOccupation & { kennel?: Kennel; animal?: any; animals?: any }>> {
  try {
    const { data: rows, error } = await supabase
      .from('kennel_occupations')
      .select('id, kennel_id, animal_id, entry_date, exit_date, vet_id, clinical_record_id, justification, kennels (id, name, type, capacity), animals (id, nome, especie, condicao, tem_tutor)')
      .order('entry_date', { ascending: false });

    if (error || !rows) {
      console.warn('fetchAllOccupationsWithKennel aviso:', error?.message);
      return [];
    }

    return rows.map(mapRemoteOccupationWithKennel);
  } catch (err) {
    console.warn('Erro ao buscar todas ocupações no Supabase:', err);
    return [];
  }
}

/**
 * Consulta todas as baias cadastradas no Supabase (incluindo registros com aliases/UUIDs históricos).
 */
export async function fetchAllKennelsFromSupabase(): Promise<Kennel[]> {
  try {
    const { data: rows, error } = await supabase
      .from('kennels')
      .select('id, name, type, capacity');
    if (error || !rows) return [];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      capacity: Number(r.capacity) || 1
    }));
  } catch {
    return [];
  }
}

/**
 * Constrói índice inteligente de resolução canônica de baias,
 * unificando UUIDs duplicados ou secundários de uma mesma baia (mesmo nome e setor).
 * Garante que qualquer ocupação referenciando uma baia seja mapeada para sua baia canônica.
 */
export function buildKennelCanonicalLookup(allKennels: Kennel[], extraKennels?: Array<Kennel | undefined>) {
  const aliasToCanonical = new Map<string, Kennel>();
  const canonicalKennels: Kennel[] = [];
  const nameTypeToCanonical = new Map<string, Kennel>();

  const list = [...allKennels, ...(extraKennels || []).filter(Boolean) as Kennel[]];

  for (const k of list) {
    if (!k || !k.id || !k.name) continue;
    const key = `${(k.type || '').trim().toLowerCase()}::${k.name.trim().toLowerCase()}`;
    let canonical = nameTypeToCanonical.get(key);
    if (!canonical) {
      canonical = k;
      nameTypeToCanonical.set(key, canonical);
      canonicalKennels.push(canonical);
    }
    aliasToCanonical.set(k.id, canonical);
  }

  return {
    aliasToCanonical,
    nameTypeToCanonical,
    canonicalKennels: canonicalKennels.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
    resolveKennel: (kennelId?: string, attachedKennel?: Kennel): Kennel | undefined => {
      if (kennelId && aliasToCanonical.has(kennelId)) {
        return aliasToCanonical.get(kennelId);
      }
      if (attachedKennel && attachedKennel.name) {
        const key = `${(attachedKennel.type || '').trim().toLowerCase()}::${attachedKennel.name.trim().toLowerCase()}`;
        if (nameTypeToCanonical.has(key)) {
          return nameTypeToCanonical.get(key);
        }
      }
      return attachedKennel;
    },
    isSameKennel: (idA?: string, idB?: string, attachedA?: Kennel, attachedB?: Kennel): boolean => {
      if (!idA && !idB) return false;
      if (idA && idB && idA === idB) return true;
      const canA = (idA && aliasToCanonical.get(idA)) || (attachedA?.name ? nameTypeToCanonical.get(`${(attachedA.type || '').trim().toLowerCase()}::${attachedA.name.trim().toLowerCase()}`) : undefined);
      const canB = (idB && aliasToCanonical.get(idB)) || (attachedB?.name ? nameTypeToCanonical.get(`${(attachedB.type || '').trim().toLowerCase()}::${attachedB.name.trim().toLowerCase()}`) : undefined);
      if (canA && canB && canA.id === canB.id) return true;
      if (canA && idB && canA.id === idB) return true;
      if (idA && canB && idA === canB.id) return true;
      if (canA && canB && canA.name.trim().toLowerCase() === canB.name.trim().toLowerCase() && canA.type === canB.type) return true;
      return false;
    }
  };
}

/**
 * Consulta o histórico completo de ocupações de um animal no Supabase
 * acompanhado dos dados da baia (kennels).
 */
export async function fetchOccupationsByAnimalId(animalId: string): Promise<Array<KennelOccupation & { kennel?: Kennel }>> {
  try {
    const { data: rows, error } = await supabase
      .from('kennel_occupations')
      .select('id, kennel_id, animal_id, entry_date, exit_date, vet_id, clinical_record_id, justification, kennels (id, name, type, capacity)')
      .eq('animal_id', animalId)
      .order('entry_date', { ascending: false });

    if (error || !rows) {
      console.warn('fetchOccupationsByAnimalId aviso:', error?.message);
      return [];
    }

    return rows.map(mapRemoteOccupationWithKennel);
  } catch (err) {
    console.warn('Erro ao buscar ocupações do animal no Supabase:', err);
    return [];
  }
}

/**
 * Consulta diretamente no Supabase a ocupação ATIVA REAL do animal com a baia relacionada.
 * Retorna null se o animal não estiver atualmente alocado em nenhuma baia.
 */
export async function fetchActiveOccupationByAnimalId(animalId: string): Promise<(KennelOccupation & { kennel?: Kennel }) | null> {
  try {
    const { data: rows, error } = await supabase
      .from('kennel_occupations')
      .select('id, kennel_id, animal_id, entry_date, exit_date, vet_id, clinical_record_id, justification, kennels (id, name, type, capacity)')
      .eq('animal_id', animalId)
      .is('exit_date', null)
      .order('entry_date', { ascending: false })
      .limit(5);

    if (error || !rows || rows.length === 0) return null;

    // Em caso de duplicidade no banco, a regra oficial prioriza a de maior entry_date (a primeira da ordenação desc)
    return mapRemoteOccupationWithKennel(rows[0]);
  } catch (err) {
    console.warn('Erro ao buscar ocupação ativa no Supabase:', err);
    return null;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  fromDatabase: boolean;
}

export interface FetchAnimalsParams {
  page: number;
  pageSize: number;
  search?: string;
  especie?: string;
  condicao?: string;
  origem?: string;
}

/**
 * Consulta de Animais com PAGINAÇÃO REAL NO BANCO (LIMIT/RANGE) e FILTROS NO POSTGREST.
 * Retorna estritamente os registros da página atual e a contagem total através de cabeçalhos.
 */
export async function fetchAnimalsPaginated(params: FetchAnimalsParams): Promise<PaginatedResult<AnimalJoined>> {
  const { page, pageSize, search, especie, condicao, origem } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('animals')
      .select(
        'id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo, castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate, motivo, data_cadastro, condicao, tutor_id, solicitante_id, usuario_responsavel_id, necessita_internacao, tipo_acomodacao_sugerida, foto',
        { count: 'exact' }
      );

    // 1. Filtro de Espécie diretamente no Supabase
    if (especie && especie !== 'TODOS') {
      query = query.eq('especie', especie);
    }

    // 2. Filtro de Condição Clínica / Acolhimento
    if (condicao && condicao !== 'TODOS') {
      query = query.eq('condicao', condicao);
    }

    // 3. Filtro de Origem (Com Tutor / Resgate)
    if (origem === 'EXTERNO') {
      query = query.eq('tem_tutor', true);
    } else if (origem === 'RESGATE') {
      query = query.eq('tem_tutor', false);
    }

    // 4. Busca por Texto diretamente no Supabase (Debounced ilike)
    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`nome.ilike.%${s}%,raca.ilike.%${s}%,numero_microchip.ilike.%${s}%`);
    }

    // 5. Ordenação e Range (Paginação no servidor PostgREST)
    const { data: rows, count, error } = await query
      .order('data_cadastro', { ascending: false })
      .range(from, to);

    if (error) {
      console.warn('Erro ao consultar animais no Supabase:', error.message);
      throw error;
    }

    const totalCount = count ?? (rows?.length || 0);

    // 6. Enriquecimento pontual (Join) APENAS para os registros da página atual
    const solicitantes = db.getSolicitantes();
    const tutores = db.getTutores();
    const users = db.getUsers();
    const records = db.getRecords();
    const logs = db.getStatusLogs();
    const occupations = db.getOccupations();
    const kennels = db.getKennels();
    const cirurgias = db.getCirurgias();

    const joinedList: AnimalJoined[] = (rows || []).map((row: any) => {
      const animal = mapSupabaseToAnimal(row);
      const currentOcc = getActiveOccupation(occupations, animal.id);
      const animalCirurgias = cirurgias.filter(c => c.animalId === animal.id);

      return {
        ...animal,
        solicitante: solicitantes.find(s => s.id === animal.solicitanteId),
        tutor: animal.tutorId ? tutores.find(t => t.id === animal.tutorId) : undefined,
        usuarioResponsavel: users.find(u => u.id === animal.usuarioResponsavelId),
        historico: records.filter(r => r.animalId === animal.id && !r.inativo),
        statusLogs: logs.filter(l => l.animalId === animal.id),
        currentOccupation: currentOcc ? { ...currentOcc, kennel: currentOcc.kennel || kennels.find(k => k.id === currentOcc.kennelId) } : undefined,
        cirurgias: animalCirurgias
      };
    });

    return {
      data: joinedList,
      totalCount,
      fromDatabase: true
    };
  } catch (e) {
    // Fallback gracioso offline caso o Supabase não responda
    console.warn('Fallback para cache local em fetchAnimalsPaginated:', e);
    const localAll = db.getAnimalsJoined();
    
    const filtered = localAll.filter(a => {
      const matchEspecie = !especie || especie === 'TODOS' || a.especie === especie;
      const matchCondicao = !condicao || condicao === 'TODOS' || a.condicao === condicao;
      const matchOrigem = !origem || origem === 'TODOS' || (origem === 'EXTERNO' ? a.temTutor : !a.temTutor);
      const s = search ? search.toLowerCase().trim() : '';
      const matchSearch = !s || a.nome.toLowerCase().includes(s) || a.raca.toLowerCase().includes(s) || (a.numeroMicrochip && a.numeroMicrochip.toLowerCase().includes(s));
      return matchEspecie && matchCondicao && matchOrigem && matchSearch;
    });

    const pageData = filtered.slice(from, from + pageSize);
    return {
      data: pageData,
      totalCount: filtered.length,
      fromDatabase: false
    };
  }
}

export interface FetchTutoresParams {
  page: number;
  pageSize: number;
  search?: string;
}

/**
 * Consulta de Tutores com PAGINAÇÃO REAL NO BANCO e FILTRO ILIKE
 */
export async function fetchTutoresPaginated(params: FetchTutoresParams): Promise<PaginatedResult<Tutor & { animalCount: number }>> {
  const { page, pageSize, search } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('tutores')
      .select('id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro', { count: 'exact' });

    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`nome_completo.ilike.%${s}%,cpf.ilike.%${s}%`);
    }

    const { data: rows, count, error } = await query
      .order('nome_completo', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const animals = db.getAnimals();
    const mapped = (rows || []).map((row: any) => {
      const t = mapSupabaseToTutor(row);
      return {
        ...t,
        animalCount: animals.filter(a => a.tutorId === t.id).length
      };
    });

    return {
      data: mapped,
      totalCount: count ?? mapped.length,
      fromDatabase: true
    };
  } catch (e) {
    console.warn('Fallback para cache local em fetchTutoresPaginated:', e);
    const local = db.getTutores();
    const animals = db.getAnimals();
    const s = search ? search.toLowerCase().trim() : '';
    const filtered = local.filter(t => !s || t.nomeCompleto.toLowerCase().includes(s) || t.cpf.includes(s));
    const paginated = filtered.slice(from, from + pageSize).map(t => ({
      ...t,
      animalCount: animals.filter(a => a.tutorId === t.id).length
    }));

    return {
      data: paginated,
      totalCount: filtered.length,
      fromDatabase: false
    };
  }
}

export interface FetchSolicitantesParams {
  page: number;
  pageSize: number;
  search?: string;
  tipo?: string;
}

/**
 * Consulta de Solicitantes com PAGINAÇÃO REAL NO BANCO e FILTRO ILIKE
 */
export async function fetchSolicitantesPaginated(params: FetchSolicitantesParams): Promise<PaginatedResult<Solicitante & { rescueCount: number }>> {
  const { page, pageSize, search, tipo } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('solicitantes')
      .select('id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes', { count: 'exact' })
      .neq('id', 'system-configs-v1');

    if (tipo && tipo !== 'ALL') {
      if (tipo === 'ONG') {
        query = query.eq('tipo', 'ONG');
      } else if (tipo === 'CIDADAO') {
        query = query.eq('tipo', 'CIDADAO');
      } else if (tipo === 'ORGAO_PUBLICO') {
        query = query.eq('tipo', 'ORGAO_PUBLICO');
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`nome_completo.ilike.%${s}%,cpf.ilike.%${s}%,codigo_ong.ilike.%${s}%,responsavel.ilike.%${s}%`);
    }

    const { data: rows, count, error } = await query
      .order('nome_completo', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const animals = db.getAnimals();
    const mapped = (rows || []).map((row: any) => {
      const s = mapSupabaseToSolicitante(row);
      return {
        ...s,
        rescueCount: animals.filter(a => a.solicitanteId === s.id).length
      };
    });

    return {
      data: mapped,
      totalCount: count ?? mapped.length,
      fromDatabase: true
    };
  } catch (e) {
    console.warn('Fallback para cache local em fetchSolicitantesPaginated:', e);
    const local = db.getSolicitantes();
    const animals = db.getAnimals();
    const s = search ? search.toLowerCase().trim() : '';
    const filtered = local.filter(item => {
      if (tipo === 'ONG' && item.tipo !== 'ONG' && !item.codigoOng) return false;
      if (tipo === 'CIDADAO' && item.tipo !== 'CIDADAO' && (item.tipo || item.codigoOng)) return false;
      if (tipo === 'ORGAO_PUBLICO' && item.tipo !== 'ORGAO_PUBLICO') return false;
      if (!s) return true;
      return item.nomeCompleto.toLowerCase().includes(s) || item.cpf.includes(s) || (item.codigoOng && item.codigoOng.toLowerCase().includes(s));
    });

    const paginated = filtered.slice(from, from + pageSize).map(item => ({
      ...item,
      rescueCount: animals.filter(a => a.solicitanteId === item.id).length
    }));

    return {
      data: paginated,
      totalCount: filtered.length,
      fromDatabase: false
    };
  }
}

/**
 * Consulta todos os prontuários clínicos do animal diretamente no Supabase (Fonte Canônica)
 * vinculando prescrições/receituários, encaminhamentos e laudos laboratoriais.
 * Mescla com segurança com o cache local para não perder nenhum dado e atualiza o armazenamento offline.
 */
export async function fetchClinicalRecordsByAnimalId(animalId: string): Promise<ClinicalRecord[]> {
  try {
    // 1. Busca os registros clínicos do animal no Supabase
    const { data: recordRows, error: recErr } = await supabase
      .from('clinical_records')
      .select('*')
      .eq('animal_id', animalId)
      .order('data_atendimento', { ascending: false });

    // 2. Busca as prescrições do animal no Supabase
    const { data: prescRows } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('animal_id', animalId)
      .order('created_at', { ascending: false });

    // 3. Busca encaminhamentos do animal no Supabase
    const { data: refRows } = await supabase
      .from('referrals')
      .select('*')
      .eq('animal_id', animalId)
      .order('created_at', { ascending: false });

    const recordIds = (recordRows || []).map(r => r.id);
    let examRows: any[] = [];
    if (recordIds.length > 0) {
      try {
        const { data: exams } = await supabase
          .from('exam_files')
          .select('*')
          .in('prontuario_id', recordIds);
        if (exams) examRows = exams;
      } catch (_) {}
    }

    // 4. Mapeia registros do Supabase
    const remoteRecords: ClinicalRecord[] = (recordRows || []).map(row => {
      const recPrescriptions: Prescription[] = (prescRows || [])
        .filter(p => {
          if (p.prontuario_id && p.prontuario_id === row.id) return true;
          if (!p.prontuario_id && recordRows?.length === 1) return true;
          if (p.data_emissao && row.data_atendimento) {
            const diff = Math.abs(new Date(p.data_emissao).getTime() - new Date(row.data_atendimento).getTime());
            if (diff < 12 * 60 * 60 * 1000) return true;
          }
          return false;
        })
        .map(p => ({
          id: p.id,
          medicamento: p.medicamento,
          dosagem: p.dosagem,
          via: p.via,
          frequencia: p.frequencia,
          duracao: p.duracao,
          observacoes: p.observacoes || '',
          animalId: p.animal_id,
          prontuarioId: p.prontuario_id || row.id,
          veterinarioId: p.veterinario_id,
          dataEmissao: p.data_emissao
        }));

      const recReferrals: Referral[] = (refRows || [])
        .filter(rf => {
          if (rf.prontuario_id && rf.prontuario_id === row.id) return true;
          if (rf.local_sugerido && rf.local_sugerido.includes(`[PRONTUARIO:${row.id}]`)) return true;
          if (!rf.prontuario_id && recordRows?.length === 1) return true;
          if (rf.data_emissao && row.data_atendimento) {
            const diff = Math.abs(new Date(rf.data_emissao).getTime() - new Date(row.data_atendimento).getTime());
            if (diff < 12 * 60 * 60 * 1000) return true;
          }
          return false;
        })
        .map(rf => {
          const cleanLocal = (rf.local_sugerido || '').replace(/\s*\[PRONTUARIO:[^\]]+\]\s*/g, '').trim();
          return {
            id: rf.id,
            animalId: rf.animal_id,
            veterinarioId: rf.veterinario_id,
            especialidade: rf.especialidade,
            motivo: rf.motivo,
            localSugerido: cleanLocal,
            urgencia: rf.urgencia as any,
            dataEmissao: rf.data_emissao
          };
        });

      const recExams: ExamFile[] = examRows
        .filter(e => e.prontuario_id === row.id)
        .map(e => ({
          id: e.id,
          prontuarioId: e.prontuario_id,
          nomeExame: e.nome_exame,
          arquivo: e.arquivo,
          dataAnexo: e.data_anexo
        }));

      const base = mapSupabaseToRecord(row);
      return {
        ...base,
        receitas: recPrescriptions,
        encaminhamentos: recReferrals,
        examesLaboratoriais: recExams
      };
    });

    // 5. Mescla de forma segura com o cache local (sem apagar nem substituir registros existentes)
    const localRecords = db.getRecords().filter(r => r.animalId === animalId);
    const recordsMap = new Map<string, ClinicalRecord>();

    // Primeiro insere os remotos
    remoteRecords.forEach(r => recordsMap.set(r.id, r));

    // Mescla com locais preservando receitas/encaminhamentos caso local tenha dados mais ricos
    localRecords.forEach(lr => {
      const existing = recordsMap.get(lr.id);
      if (!existing) {
        recordsMap.set(lr.id, lr);
      } else {
        const mergedReceitas = (existing.receitas && existing.receitas.length > 0) ? existing.receitas : (lr.receitas || []);
        const mergedEnc = (existing.encaminhamentos && existing.encaminhamentos.length > 0) ? existing.encaminhamentos : (lr.encaminhamentos || []);
        const mergedExams = (existing.examesLaboratoriais && existing.examesLaboratoriais.length > 0) ? existing.examesLaboratoriais : (lr.examesLaboratoriais || []);
        recordsMap.set(lr.id, {
          ...lr,
          ...existing,
          receitas: mergedReceitas,
          encaminhamentos: mergedEnc,
          examesLaboratoriais: mergedExams
        });
      }
    });

    const finalRecords = Array.from(recordsMap.values())
      .filter(r => !r.inativo)
      .sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime());

    // Atualiza pontualmente o cache local de records deste animal
    try {
      const allLocal = db.getRecords();
      const otherRecords = allLocal.filter(r => r.animalId !== animalId);
      const newAllRecords = [...otherRecords, ...finalRecords];
      localStorage.setItem('sisbem_records', JSON.stringify(newAllRecords));
    } catch (_) {}

    return finalRecords;
  } catch (err) {
    console.warn('Erro ao consultar prontuários no Supabase:', err);
    return db.getRecords().filter(r => r.animalId === animalId && !r.inativo);
  }
}

/**
 * Busca os dados de um animal específico diretamente no Supabase por ID com relacionamentos.
 * Usado para abrir a ficha completa mesmo que o animal não esteja no cache local recente.
 */
export async function fetchAnimalById(id: string): Promise<AnimalJoined | null> {
  try {
    const { data: row, error } = await supabase
      .from('animals')
      .select('id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo, castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate, motivo, data_cadastro, condicao, tutor_id, solicitante_id, usuario_responsavel_id, necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao, foto, data_obito, causa_obito, data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone, resgate_samuvet, responsavel_samuvet')
      .eq('id', id)
      .maybeSingle();

    if (error || !row) return null;

    const animal = mapSupabaseToAnimal(row);
    const solicitantes = db.getSolicitantes();
    const tutores = db.getTutores();
    const users = db.getUsers();
    const logs = db.getStatusLogs();
    const kennels = db.getKennels();
    const cirurgias = db.getCirurgias();

    // 1. Busca prontuários clínicos completos no Supabase (Fonte Canônica Oficial)
    const animalRecords = await fetchClinicalRecordsByAnimalId(id);

    // 2. Busca ocupações do animal diretamente no Supabase (fonte oficial)
    const remoteOccs = await fetchOccupationsByAnimalId(id);
    const activeOcc = getActiveOccupation(remoteOccs) || getActiveOccupation(db.getOccupations(), animal.id);

    // 3. Se obteve dados do Supabase, sincroniza pontualmente o cache local deste animal
    if (remoteOccs && remoteOccs.length > 0) {
      try {
        const localOccs: KennelOccupation[] = JSON.parse(localStorage.getItem('sisbem_occupations') || '[]');
        const map = new Map<string, KennelOccupation>();
        localOccs.forEach(o => map.set(o.id, o));
        remoteOccs.forEach(r => map.set(r.id, r));
        localStorage.setItem('sisbem_occupations', JSON.stringify(Array.from(map.values())));
      } catch (e) {}
    }

    const animalCirurgias = cirurgias.filter(c => c.animalId === animal.id);

    // 4. Resolve a baia da ocupação ativa (prioriza o join do Supabase, fallback para db.getKennels())
    const resolvedKennel = activeOcc?.kennel || (activeOcc ? kennels.find(k => k.id === activeOcc.kennelId) : undefined);

    return {
      ...animal,
      solicitante: solicitantes.find(s => s.id === animal.solicitanteId),
      tutor: animal.tutorId ? tutores.find(t => t.id === animal.tutorId) : undefined,
      usuarioResponsavel: users.find(u => u.id === animal.usuarioResponsavelId),
      historico: animalRecords,
      statusLogs: logs.filter(l => l.animalId === animal.id),
      currentOccupation: activeOcc ? { ...activeOcc, kennel: resolvedKennel } : undefined,
      cirurgias: animalCirurgias
    };
  } catch (err) {
    console.warn('Erro ao buscar animal por id no Supabase:', err);
    return null;
  }
}

/**
 * Interface dos animais que aguardam vaga/alocação na fila de acomodação.
 */
export interface WaitingAccommodationAnimal {
  id: string;
  nome: string;
  especie: string;
  raca?: string;
  condicao: AnimalCondicao;
  dataCadastro: string;
  temTutor: boolean;
  tutorId?: string;
  solicitanteId?: string;
  necessitaInternacao: boolean;
  tipoAcomodacaoSugerida?: string;
  justificativaInternacao?: string;
  localResgate?: string;
  tutor?: {
    id?: string;
    nomeCompleto: string;
  };
  solicitante?: {
    id?: string;
    nomeCompleto: string;
  };
  historico?: ClinicalRecord[];
}

/**
 * Consulta diretamente no Supabase a lista oficial de animais que estão aguardando acomodação.
 * Regra:
 * 1. Condição: 'Em Tratamento' OU 'Disponível para Adoção' OU necessita_internacao = true
 * 2. Condições excluídas: 'Em Atendimento', 'Óbito', 'Soltura', 'Adotado', 'Atendido', 'Alta'
 * 3. Não deve possuir ocupação ativa (exit_date IS NULL) em kennel_occupations
 * 4. Projeção estrita: busca somente os campos necessários sem SELECT *
 */
export async function fetchWaitingAccommodationAnimals(): Promise<WaitingAccommodationAnimal[]> {
  try {
    // 1. Busca IDs de animais que possuem ocupação ativa no Supabase
    const { data: activeOccRows, error: occError } = await supabase
      .from('kennel_occupations')
      .select('animal_id')
      .is('exit_date', null);

    if (occError) {
      console.warn('[fetchWaitingAccommodationAnimals] Erro ao buscar ocupações ativas:', occError.message);
    }

    const activeAnimalIdSet = new Set((activeOccRows || []).map((o: any) => o.animal_id).filter(Boolean));

    // 2. Consulta no Supabase somente os campos estritamente necessários
    const { data: animalRows, error: animalError } = await supabase
      .from('animals')
      .select(`
        id,
        nome,
        especie,
        raca,
        condicao,
        data_cadastro,
        tem_tutor,
        tutor_id,
        solicitante_id,
        necessita_internacao,
        tipo_acomodacao_sugerida,
        justificativa_internacao,
        local_resgate,
        tutores (id, nome_completo),
        solicitantes (id, nome_completo)
      `)
      .not('condicao', 'in', '("Em Atendimento","Óbito","Soltura","Adotado","Atendido","Alta")')
      .or('condicao.eq.Em Tratamento,condicao.eq.Disponível para Adoção,necessita_internacao.eq.true')
      .order('data_cadastro', { ascending: true });

    if (animalError) {
      console.error('[fetchWaitingAccommodationAnimals] Erro ao buscar animais:', animalError);
      throw animalError;
    }

    // 3. Filtra os animais que NÃO estão com baia ativa no momento
    const eligible = (animalRows || []).filter((row: any) => !activeAnimalIdSet.has(row.id));

    // 4. Mapeia para a estrutura de WaitingAccommodationAnimal
    return eligible.map((row: any) => {
      const tutorData = row.tutores 
        ? { id: row.tutores.id, nomeCompleto: row.tutores.nome_completo }
        : undefined;

      const solicitanteData = row.solicitantes
        ? { id: row.solicitantes.id, nomeCompleto: row.solicitantes.nome_completo }
        : undefined;

      return {
        id: row.id,
        nome: row.nome || 'Sem Nome',
        especie: row.especie || 'Cão',
        raca: row.raca || 'SRD',
        condicao: row.condicao as AnimalCondicao,
        dataCadastro: row.data_cadastro,
        temTutor: !!row.tem_tutor,
        tutorId: row.tutor_id || undefined,
        solicitanteId: row.solicitante_id || undefined,
        necessitaInternacao: !!row.necessita_internacao,
        tipoAcomodacaoSugerida: row.tipo_acomodacao_sugerida || undefined,
        justificativaInternacao: row.justificativa_internacao || undefined,
        localResgate: row.local_resgate || undefined,
        tutor: tutorData,
        solicitante: solicitanteData,
      };
    });
  } catch (err) {
    console.warn('[fetchWaitingAccommodationAnimals] Exceção na consulta Supabase:', err);
    throw err;
  }
}
