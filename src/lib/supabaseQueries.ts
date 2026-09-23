import { supabase } from './supabase';
import { AnimalJoined, Solicitante, Tutor, AnimalCondicao, KennelOccupation } from '../../types';
import { mapSupabaseToAnimal, mapSupabaseToTutor, mapSupabaseToSolicitante } from './supabaseSync';
import { db } from '../../services/db';

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
      const currentOcc = occupations.find((o: KennelOccupation) => o.animalId === animal.id && !o.exitDate);
      const animalCirurgias = cirurgias.filter(c => c.animalId === animal.id);

      return {
        ...animal,
        solicitante: solicitantes.find(s => s.id === animal.solicitanteId),
        tutor: animal.tutorId ? tutores.find(t => t.id === animal.tutorId) : undefined,
        usuarioResponsavel: users.find(u => u.id === animal.usuarioResponsavelId),
        historico: records.filter(r => r.animalId === animal.id && !r.inativo),
        statusLogs: logs.filter(l => l.animalId === animal.id),
        currentOccupation: currentOcc ? { ...currentOcc, kennel: kennels.find(k => k.id === currentOcc.kennelId) } : undefined,
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
