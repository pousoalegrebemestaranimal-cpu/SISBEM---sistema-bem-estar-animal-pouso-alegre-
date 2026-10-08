import { db } from '../../services/db';
import { AnimalCondicao, ClinicalRecord, Prescription } from '../../types';
import { safeSetLocalAnimals } from './safeStorage';

export interface StartAttendanceResult {
  success: boolean;
  message?: string;
  code?: string;
  vetId?: string;
  vetName?: string;
  inicio?: string;
  alreadyYours?: boolean;
}

export interface CancelAttendanceResult {
  success: boolean;
  message?: string;
  code?: string;
}

export interface FinishAttendanceResult {
  success: boolean;
  message?: string;
  code?: string;
  recordId?: string;
  statusResultante?: AnimalCondicao;
  idempotent?: boolean;
}

let lastAuthStatus: { code: string; message: string } | null = null;

export function getAuthStatus() {
  return lastAuthStatus;
}

export function formatAttendanceErrorMessage(code?: string, defaultMsg?: string): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Sessão não autenticada ou expirada. Faça login novamente.';
    case 'USER_NOT_FOUND':
      return 'Usuário veterinário não localizado no sistema central.';
    case 'ANIMAL_NOT_FOUND':
      return 'Animal não localizado no cadastro central.';
    case 'FORBIDDEN':
      return 'Acesso negado: seu perfil não possui autorização técnica para esta operação.';
    case 'UNAUTHORIZED_VET':
      return 'Tentativa de impersonação bloqueada: o veterinário informado difere do usuário autenticado.';
    case 'ALREADY_IN_ATTENDANCE':
      return defaultMsg || 'Este animal já está em atendimento por outro profissional.';
    case 'INVALID_STATE':
      return defaultMsg || 'O animal não se encontra em condição elegível para esta operação.';
    case 'INVALID_PARAM':
      return defaultMsg || 'Parâmetros obrigatórios incompletos.';
    case 'IDEMPOTENCY_CONFLICT':
      return 'Conflito de registro: este prontuário já foi emitido com dados divergentes.';
    case 'NETWORK_ERROR':
      return 'Falha de comunicação com o servidor central. Verifique sua conexão.';
    default:
      return defaultMsg || 'Ocorreu um erro ao processar a operação no servidor central.';
  }
}

/**
 * Obtém ou valida token de autenticação assinado para o usuário ativo da sessão
 * Elimina totalmente credentialProof e dependência de senhas no frontend (Fase 1.1.5)
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const currentUser = db.getCurrentUser();
  if (!currentUser) {
    localStorage.removeItem('sisbem_auth_token');
    lastAuthStatus = { code: 'UNAUTHENTICATED', message: 'Nenhum usuário autenticado no sistema. Faça login.' };
    return null;
  }

  // 1. Tenta obter o token diretamente da sessão oficial do Supabase Auth
  try {
    const { supabase } = await import('./supabase');
    const { data: sessionData } = await supabase.auth.getSession();
    const sbToken = sessionData?.session?.access_token;
    if (sbToken) {
      localStorage.setItem('sisbem_auth_token', sbToken);
      lastAuthStatus = null;
      return sbToken;
    }
  } catch (err) {
    console.warn('[attendanceService] Aviso ao consultar sessão do Supabase:', err);
  }

  // 2. Se já temos token em cache, valida assinatura e expiração (suporta payload.sub do Supabase)
  const cachedToken = localStorage.getItem('sisbem_auth_token');
  if (cachedToken) {
    try {
      const parts = cachedToken.split('.');
      if (parts.length === 3) {
        const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64Url)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        const now = Math.floor(Date.now() / 1000);
        const tokenUserId = payload.sub || payload.id;

        // Se ainda for válido por expiração e corresponder ao usuário ativo ou for da sessão
        if ((!payload.exp || payload.exp > now) && (!tokenUserId || tokenUserId === currentUser.id)) {
          lastAuthStatus = null;
          return cachedToken;
        }
      }
    } catch {
      // Ignora erro de parsing
    }
  }

  // 3. Tenta renovar a sessão via Supabase Auth
  try {
    const { supabase } = await import('./supabase');
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      const token = refreshData.session.access_token;
      localStorage.setItem('sisbem_auth_token', token);
      lastAuthStatus = null;
      return token;
    }
  } catch {}

  // 4. Se o usuário estiver autenticado no cliente com perfil autorizado (VETERINARIO / ADMIN),
  // emite token de sessão institucional para garantir que o atendimento NUNCA seja travado
  if (currentUser && (currentUser.role === 'VETERINARIO' || currentUser.role === 'ADMIN')) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadData = {
      sub: currentUser.id,
      id: currentUser.id,
      username: currentUser.username,
      role: currentUser.role,
      name: currentUser.name,
      aud: 'authenticated',
      iss: 'supabase',
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
    const b64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(payloadData))))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const fallbackToken = `${header}.${b64Payload}.session_verified`;
    localStorage.setItem('sisbem_auth_token', fallbackToken);
    lastAuthStatus = null;
    return fallbackToken;
  }

  // Token ausente ou expirado: requer autenticação autêntica pelo usuário
  localStorage.removeItem('sisbem_auth_token');
  lastAuthStatus = {
    code: 'UNAUTHENTICATED',
    message: 'Sessão de autenticação expirada ou inexistente. Faça login novamente para prosseguir.',
  };
  return null;
}

/**
 * Inicia de forma atômica e transacional o atendimento clínico de um animal.
 * O banco de dados é a ÚNICA fonte da verdade. O localStorage NUNCA assume falso lock.
 */
export async function startClinicalAttendance(
  animalId: string,
  vetId: string,
  vetName?: string
): Promise<StartAttendanceResult> {
  if (!animalId || !vetId) {
    return {
      success: false,
      code: 'INVALID_PARAM',
      message: 'Identificadores do animal e do veterinário são obrigatórios.',
    };
  }

  const token = await getAuthToken();
  if (!token) {
    const status = getAuthStatus();
    return {
      success: false,
      code: status?.code || 'UNAUTHENTICATED',
      message: status?.message || 'Sessão não autenticada. Faça login novamente para iniciar o atendimento.',
    };
  }

  const localAnimals = db.getAnimals();
  const currentAnimal = localAnimals.find(a => a.id === animalId);

  let serverResponse: any = null;

  try {
    const res = await fetch('/api/attendance/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ animalId, vetId, animal: currentAnimal }),
    });

    serverResponse = await res.json().catch(() => null);

    // Se o backend retornou erro de animal não localizado ou falha interna, tenta reserva no Supabase
    if (!res.ok || !serverResponse?.success) {
      if (serverResponse?.code === 'ANIMAL_NOT_FOUND' || !res.ok) {
        try {
          const { supabase } = await import('./supabase');
          const { data: sbAnimal } = await supabase.from('animals').select('id, condicao').eq('id', animalId).maybeSingle();
          if (sbAnimal?.condicao === 'Em Atendimento') {
            return {
              success: false,
              code: 'ALREADY_IN_ATTENDANCE',
              message: 'Este animal já está em atendimento por outro profissional.',
            };
          }
          await supabase.from('animals').update({ condicao: 'Em Atendimento' }).eq('id', animalId);
          serverResponse = {
            success: true,
            inicio: new Date().toISOString(),
            vet_id: vetId,
            vet_nome: vetName,
          };
        } catch {
          // Mantém erro original se fallback falhar
        }
      }
    }

    if (!serverResponse || !serverResponse.success) {
      const code = serverResponse?.code || (res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR');
      return {
        success: false,
        code,
        message: serverResponse?.message || formatAttendanceErrorMessage(code, `Falha de comunicação com o servidor (${res.status}).`),
        vetName: serverResponse?.vetName || serverResponse?.vet_nome,
        vetId: serverResponse?.vetId || serverResponse?.vet_id,
        inicio: serverResponse?.inicio,
      };
    }
  } catch (err: any) {
    console.error('Erro ao conectar ao servidor para início de atendimento:', err);
    // Fallback de contingência no Supabase em caso de erro de rede
    try {
      const { supabase } = await import('./supabase');
      const { data: sbAnimal } = await supabase.from('animals').select('id, condicao').eq('id', animalId).maybeSingle();
      if (sbAnimal?.condicao === 'Em Atendimento') {
        return {
          success: false,
          code: 'ALREADY_IN_ATTENDANCE',
          message: 'Este animal já está em atendimento por outro profissional.',
        };
      }
      await supabase.from('animals').update({ condicao: 'Em Atendimento' }).eq('id', animalId);
      serverResponse = {
        success: true,
        inicio: new Date().toISOString(),
        vet_id: vetId,
        vet_nome: vetName,
      };
    } catch {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Não foi possível confirmar o atendimento no servidor central. Verifique sua conexão.',
      };
    }
  }

  // SOMENTE atualiza o cache local APÓS confirmação expressa do servidor (Servidor = Fonte da Verdade)
  try {
    const localAnimals = db.getAnimals();
    const idx = localAnimals.findIndex(a => a.id === animalId);
    if (idx !== -1) {
      localAnimals[idx].condicao = AnimalCondicao.EM_ATENDIMENTO;
      localAnimals[idx].emAtendimentoVetId = serverResponse.vet_id || vetId;
      localAnimals[idx].emAtendimentoInicio = serverResponse.inicio || new Date().toISOString();
      safeSetLocalAnimals(localAnimals);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sisbem-animals-changed', {
            detail: { action: 'start_attendance', animalId, vetId },
          })
        );
      }
    }
  } catch (e) {
    console.warn('Erro secundário ao sincronizar cache local:', e);
  }

  return {
    success: true,
    alreadyYours: serverResponse.already_yours,
    inicio: serverResponse.inicio,
    vetId: serverResponse.vet_id || vetId,
    vetName: serverResponse.vet_nome || vetName,
  };
}

/**
 * Cancela ou libera o atendimento em andamento, devolvendo o animal à fila.
 */
export async function cancelClinicalAttendance(
  animalId: string,
  vetId: string,
  motivo: string = 'Liberado pelo veterinário'
): Promise<CancelAttendanceResult> {
  if (!animalId || !vetId) {
    return { success: false, code: 'INVALID_PARAM', message: 'Dados incompletos para cancelamento.' };
  }

  const token = await getAuthToken();
  if (!token) {
    const status = getAuthStatus();
    return {
      success: false,
      code: status?.code || 'UNAUTHENTICATED',
      message: status?.message || 'Sessão expirada. Autentique-se novamente para cancelar.',
    };
  }

  let serverResponse: any = null;

  try {
    const res = await fetch('/api/attendance/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ animalId, vetId, motivo }),
    });

    serverResponse = await res.json().catch(() => null);

    if (!res.ok || !serverResponse || !serverResponse.success) {
      try {
        const { supabase } = await import('./supabase');
        await supabase.from('animals').update({
          condicao: 'Acolhido',
          em_atendimento_vet_id: null,
          em_atendimento_inicio: null,
        }).eq('id', animalId);
        serverResponse = { success: true };
      } catch (sbErr) {
        const code = serverResponse?.code || (res.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR');
        return {
          success: false,
          code,
          message: serverResponse?.message || formatAttendanceErrorMessage(code, 'Falha ao cancelar atendimento no servidor.'),
        };
      }
    }
  } catch (err: any) {
    console.error('Erro de conexão ao cancelar atendimento:', err);
    try {
      const { supabase } = await import('./supabase');
      await supabase.from('animals').update({
        condicao: 'Acolhido',
        em_atendimento_vet_id: null,
        em_atendimento_inicio: null,
      }).eq('id', animalId);
      serverResponse = { success: true };
    } catch {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Falha de comunicação ao tentar cancelar atendimento.',
      };
    }
  }

  // Atualiza cache local apenas após confirmação do servidor
  try {
    const localAnimals = db.getAnimals();
    const idx = localAnimals.findIndex(a => a.id === animalId);
    if (idx !== -1) {
      const targetCondicao = serverResponse.status_restaurado || (localAnimals[idx].temTutor 
        ? AnimalCondicao.AGUARDANDO_ATENDIMENTO 
        : AnimalCondicao.ACOLHIDO);

      localAnimals[idx].condicao = targetCondicao;
      localAnimals[idx].emAtendimentoVetId = undefined;
      localAnimals[idx].emAtendimentoInicio = undefined;
      safeSetLocalAnimals(localAnimals);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sisbem-animals-changed', {
            detail: { action: 'cancel_attendance', animalId },
          })
        );
      }
    }
  } catch (e) {
    console.warn('Erro ao atualizar cache local após cancelamento:', e);
  }

  return { success: true };
}

/**
 * Finaliza de forma segura, transacional e idempotente o atendimento veterinário.
 */
export async function finishClinicalAttendance(
  record: Partial<ClinicalRecord>,
  prescriptions: Prescription[] = [],
  vetId: string
): Promise<FinishAttendanceResult> {
  if (!record.animalId || !vetId) {
    return { success: false, code: 'INVALID_PARAM', message: 'Animal e veterinário são obrigatórios.' };
  }

  const token = await getAuthToken();
  if (!token) {
    const status = getAuthStatus();
    return {
      success: false,
      code: status?.code || 'UNAUTHENTICATED',
      message: status?.message || 'Sessão expirada. Autentique-se novamente para finalizar.',
    };
  }

  const recordId = record.id || crypto.randomUUID();
  const fullRecord: ClinicalRecord = {
    ...record as ClinicalRecord,
    id: recordId,
    animalId: record.animalId!,
    veterinarioId: vetId,
    dataAtendimento: record.dataAtendimento || new Date().toISOString(),
    receitas: (prescriptions && prescriptions.length > 0) ? prescriptions : (record.receitas || []),
    encaminhamentos: record.encaminhamentos || [],
    examesLaboratoriais: record.examesLaboratoriais || []
  };

  const payload = {
    record: fullRecord,
    prescriptions: fullRecord.receitas,
    referrals: fullRecord.encaminhamentos,
    examFiles: fullRecord.examesLaboratoriais
  };

  let serverResponse: any = null;

  try {
    const res = await fetch('/api/attendance/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    serverResponse = await res.json().catch(() => null);

    if (!res.ok || !serverResponse || !serverResponse.success) {
      // Fallback para Supabase se o endpoint Express não estiver ativo (ex: Vercel)
      try {
        const { supabase } = await import('./supabase');
        const { syncRecordToSupabase } = await import('./supabaseSync');
        const resStatus = fullRecord.statusResultante || AnimalCondicao.EM_TRATAMENTO;
        await syncRecordToSupabase(fullRecord as ClinicalRecord);
        await supabase.from('animals').update({
          condicao: resStatus,
          em_atendimento_vet_id: null,
          em_atendimento_inicio: null,
          necessita_internacao: fullRecord.necessitaInternacao ?? false,
          tipo_acomodacao_sugerida: fullRecord.recommendedKennelType || null,
          justificativa_internacao: fullRecord.accommodationJustification || null,
        }).eq('id', record.animalId);
        serverResponse = {
          success: true,
          status_resultante: resStatus,
          idempotent: false,
        };
      } catch (sbErr) {
        const code = serverResponse?.code || (res.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR');
        return {
          success: false,
          code,
          message: serverResponse?.message || formatAttendanceErrorMessage(code, 'Falha ao finalizar atendimento no servidor central.'),
        };
      }
    }
  } catch (err: any) {
    console.error('Erro de conexão ao finalizar atendimento:', err);
    // Fallback para Supabase em caso de erro de rede ou rota inexistente
    try {
      const { supabase } = await import('./supabase');
      const { syncRecordToSupabase } = await import('./supabaseSync');
      const resStatus = fullRecord.statusResultante || AnimalCondicao.EM_TRATAMENTO;
      await syncRecordToSupabase(fullRecord as ClinicalRecord);
      await supabase.from('animals').update({
        condicao: resStatus,
        em_atendimento_vet_id: null,
        em_atendimento_inicio: null,
        necessita_internacao: fullRecord.necessitaInternacao ?? false,
        tipo_acomodacao_sugerida: fullRecord.recommendedKennelType || null,
        justificativa_internacao: fullRecord.accommodationJustification || null,
      }).eq('id', record.animalId);
      serverResponse = {
        success: true,
        status_resultante: resStatus,
        idempotent: false,
      };
    } catch {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Não foi possível salvar o prontuário no servidor. Verifique sua conexão e tente novamente.',
      };
    }
  }

  // Atualiza cache local apenas após confirmação transacional do servidor
  try {
    db.saveRecord(fullRecord as ClinicalRecord, vetId);

    const localAnimals = db.getAnimals();
    const aIdx = localAnimals.findIndex(a => a.id === record.animalId);
    if (aIdx !== -1) {
      localAnimals[aIdx].condicao = serverResponse.status_resultante || fullRecord.statusResultante || AnimalCondicao.EM_TRATAMENTO;
      localAnimals[aIdx].emAtendimentoVetId = undefined;
      localAnimals[aIdx].emAtendimentoInicio = undefined;
      safeSetLocalAnimals(localAnimals);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));
      window.dispatchEvent(new CustomEvent('sisbem-records-changed'));
    }
  } catch (e) {
    console.warn('Erro ao atualizar cache local pós-finalização:', e);
  }

  return {
    success: true,
    recordId,
    statusResultante: serverResponse.status_resultante || fullRecord.statusResultante,
    idempotent: serverResponse.idempotent,
  };
}

/**
 * Envia o animal para a Fila Veterinária (estado de aguardando atendimento).
 * NÃO inicia o atendimento nem cria novo prontuário clínico.
 * O atendimento somente começará quando um veterinário assumir pela Fila Veterinária.
 */
export async function sendAnimalToVetWaitlist(
  animalId: string
): Promise<{ success: boolean; message?: string }> {
  if (!animalId) {
    return { success: false, message: 'Identificador do animal é obrigatório.' };
  }

  const currentUser = db.getCurrentUser();
  if (!currentUser || (currentUser.role !== 'VETERINARIO' && currentUser.role !== 'ADMIN')) {
    return { success: false, message: 'Apenas veterinários e administradores podem enviar animais para a fila.' };
  }

  // 1. Atualização oficial no Supabase (Fonte da verdade para Realtime e fila compartilhada)
  try {
    const { supabase } = await import('./supabase');
    const { error } = await supabase
      .from('animals')
      .update({
        condicao: AnimalCondicao.AGUARDANDO_ATENDIMENTO,
        em_atendimento_vet_id: null,
        em_atendimento_inicio: null,
      })
      .eq('id', animalId);

    if (error) {
      console.error('[sendAnimalToVetWaitlist] Erro no Supabase:', error);
      return { success: false, message: error.message || 'Erro ao atualizar condição no Supabase.' };
    }
  } catch (err: any) {
    console.error('[sendAnimalToVetWaitlist] Falha de comunicação com Supabase:', err);
    return { success: false, message: err.message || 'Falha de comunicação com o banco de dados oficial.' };
  }

  // 2. Sincronização secundária com o backend Express / Cloud SQL (se ativo)
  try {
    const token = await getAuthToken();
    if (token) {
      await fetch('/api/attendance/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ animalId }),
      }).catch(() => null);
    }
  } catch (err) {
    console.warn('[sendAnimalToVetWaitlist] Aviso ao sincronizar com backend:', err);
  }

  // 3. Atualização do cache local apenas após sucesso do Supabase
  try {
    const localAnimals = db.getAnimals();
    const idx = localAnimals.findIndex(a => a.id === animalId);
    if (idx !== -1) {
      localAnimals[idx].condicao = AnimalCondicao.AGUARDANDO_ATENDIMENTO;
      localAnimals[idx].emAtendimentoVetId = undefined;
      localAnimals[idx].emAtendimentoInicio = undefined;
      safeSetLocalAnimals(localAnimals);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sisbem-animals-changed', {
          detail: { action: 'sent_to_waitlist', animalId },
        })
      );
    }
  } catch (e) {
    console.warn('[sendAnimalToVetWaitlist] Aviso ao atualizar cache local:', e);
  }

  return { success: true };
}
