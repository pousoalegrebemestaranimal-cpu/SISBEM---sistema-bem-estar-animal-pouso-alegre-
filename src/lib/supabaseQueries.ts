import { supabase } from './supabase';
import { AnimalJoined, Solicitante, Tutor, AnimalCondicao, KennelOccupation, Kennel } from '../../types';
import { mapSupabaseToAnimal, mapSupabaseToTutor, mapSupabaseToSolicitante } from './supabaseSync';
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
 * Mapeia uma linha da tabela kennel_occupations do Supabase com join em kennels
 */
function mapRemoteOccupationWithKennel(r: any): KennelOccupation & { kennel?: Kennel } {
  const kennelData: Kennel | undefined = r.kennels ? {
    id: r.kennels.id,
    name: r.kennels.name,
    type: r.kennels.type,
    capacity: Number(r.kennels.capacity) || 1
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
    kennel: kennelData
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
    const records = db.getRecords();
    const logs = db.getStatusLogs();
    const kennels = db.getKennels();
    const cirurgias = db.getCirurgias();

    // 1. Busca ocupações do animal diretamente no Supabase (fonte oficial)
    const remoteOccs = await fetchOccupationsByAnimalId(id);
    const activeOcc = getActiveOccupation(remoteOccs) || getActiveOccupation(db.getOccupations(), animal.id);

    // 2. Se obteve dados do Supabase, sincroniza pontualmente o cache local deste animal
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

    // 3. Resolve a baia da ocupação ativa (prioriza o join do Supabase, fallback para db.getKennels())
    const resolvedKennel = activeOcc?.kennel || (activeOcc ? kennels.find(k => k.id === activeOcc.kennelId) : undefined);

    return {
      ...animal,
      solicitante: solicitantes.find(s => s.id === animal.solicitanteId),
      tutor: animal.tutorId ? tutores.find(t => t.id === animal.tutorId) : undefined,
      usuarioResponsavel: users.find(u => u.id === animal.usuarioResponsavelId),
      historico: records.filter(r => r.animalId === animal.id && !r.inativo),
      statusLogs: logs.filter(l => l.animalId === animal.id),
      currentOccupation: activeOcc ? { ...activeOcc, kennel: resolvedKennel } : undefined,
      cirurgias: animalCirurgias
    };
  } catch (err) {
    console.warn('Erro ao buscar animal por id no Supabase:', err);
    return null;
  }
}
