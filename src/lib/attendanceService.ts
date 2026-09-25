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

/**
 * Obtém ou emite token de autenticação assinado para o usuário ativo da sessão
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const cachedToken = localStorage.getItem('sisbem_auth_token');
  const currentUser = db.getCurrentUser();

  if (!currentUser) {
    localStorage.removeItem('sisbem_auth_token');
    return null;
  }

  // Se já temos token em cache, tenta reutilizar
  if (cachedToken) {
    try {
      const parts = cachedToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        // Se ainda for válido por mais de 5 minutos e corresponder ao usuário ativo
        if (payload.id === currentUser.id && payload.exp > now + 300) {
          return cachedToken;
        }
      }
    } catch {
      // Ignora erro de parsing e busca novo token
    }
  }

  // Solicita emissão de novo token seguro ao servidor Express
  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, username: currentUser.username }),
    });

    if (!res.ok) {
      console.warn('Falha na emissão de token de autenticação.');
      return null;
    }

    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('sisbem_auth_token', data.token);
      return data.token;
    }
  } catch (err) {
    console.error('Erro de conexão ao obter token de autenticação:', err);
  }

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
    return {
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Sessão não autenticada. Faça login novamente para iniciar o atendimento.',
    };
  }

  let serverResponse: any = null;

  try {
    const res = await fetch('/api/attendance/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ animalId, vetId }),
    });

    serverResponse = await res.json().catch(() => null);

    if (!res.ok || !serverResponse) {
      return {
        success: false,
        code: serverResponse?.code || (res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'),
        message: serverResponse?.message || `Falha de comunicação com o servidor (${res.status}).`,
        vetName: serverResponse?.vetName || serverResponse?.vet_nome,
        vetId: serverResponse?.vetId || serverResponse?.vet_id,
        inicio: serverResponse?.inicio,
      };
    }

    if (!serverResponse.success) {
      return {
        success: false,
        code: serverResponse.code || 'ALREADY_IN_ATTENDANCE',
        message: serverResponse.message || 'Este animal já está em atendimento por outro profissional.',
        vetName: serverResponse.vet_nome || serverResponse.vetName,
        vetId: serverResponse.vet_id || serverResponse.vetId,
        inicio: serverResponse.inicio,
      };
    }
  } catch (err: any) {
    console.error('Erro ao conectar ao servidor para início de atendimento:', err);
    // NÃO atualizar localStorage em caso de erro!
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Não foi possível confirmar o atendimento no servidor central. Verifique sua conexão.',
    };
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
    return {
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Sessão expirada. Autentique-se novamente para cancelar.',
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
      return {
        success: false,
        code: serverResponse?.code || (res.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'),
        message: serverResponse?.message || 'Falha ao cancelar atendimento no servidor.',
      };
    }
  } catch (err: any) {
    console.error('Erro de conexão ao cancelar atendimento:', err);
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Falha de comunicação ao tentar cancelar atendimento.',
    };
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
    return {
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Sessão expirada. Autentique-se novamente para finalizar.',
    };
  }

  const recordId = record.id || crypto.randomUUID();
  const fullRecord = {
    ...record,
    id: recordId,
    veterinarioId: vetId,
    dataAtendimento: record.dataAtendimento || new Date().toISOString(),
  };

  const payload = {
    record: fullRecord,
    prescriptions: prescriptions || [],
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
      return {
        success: false,
        code: serverResponse?.code || (res.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'),
        message: serverResponse?.message || 'Falha ao finalizar atendimento no servidor central.',
      };
    }
  } catch (err: any) {
    console.error('Erro de conexão ao finalizar atendimento:', err);
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Não foi possível salvar o prontuário no servidor. Verifique sua conexão e tente novamente.',
    };
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
