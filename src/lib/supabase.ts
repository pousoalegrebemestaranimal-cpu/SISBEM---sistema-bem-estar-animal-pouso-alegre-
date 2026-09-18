// Supabase URL e Chave Anon pública fornecidas para o SISBEM
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://azufmdknlvbfaxnfiwwg.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_JFhiLBJSwxMatR7YIl51nA_T7bt6Xe4';

/**
 * Sanitiza a URL removendo possíveis prefixos, aspas ou formatações acidentais como "VITE_SUPABASE_URL=https://..."
 */
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return DEFAULT_SUPABASE_URL;
  let clean = rawUrl.trim();
  clean = clean.replace(/^["']+|["']+$/g, '');
  if (clean.includes('=')) {
    const parts = clean.split('=');
    clean = parts[parts.length - 1].trim();
  }
  clean = clean.replace(/^["']+|["']+$/g, '').trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.includes('.supabase.co')) {
      clean = `https://${clean}`;
    } else {
      return DEFAULT_SUPABASE_URL;
    }
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return clean;
    }
    return DEFAULT_SUPABASE_URL;
  } catch {
    return DEFAULT_SUPABASE_URL;
  }
}

/**
 * Sanitiza a chave anon removendo prefixos acidentais ou aspas
 */
export function sanitizeSupabaseKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== 'string') return DEFAULT_SUPABASE_ANON_KEY;
  let clean = rawKey.trim();
  clean = clean.replace(/^["']+|["']+$/g, '');
  if (clean.includes('=')) {
    const parts = clean.split('=');
    clean = parts[parts.length - 1].trim();
  }
  clean = clean.replace(/^["']+|["']+$/g, '').trim();
  return clean || DEFAULT_SUPABASE_ANON_KEY;
}

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const procEnv = (typeof process !== 'undefined' && process.env) || {};

const rawUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.VITE_PUBLIC_SUPABASE_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  procEnv.VITE_SUPABASE_URL ||
  procEnv.NEXT_PUBLIC_SUPABASE_URL ||
  procEnv.SUPABASE_URL;

const rawKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  procEnv.VITE_SUPABASE_ANON_KEY ||
  procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  procEnv.SUPABASE_ANON_KEY;

export const SUPABASE_URL: string = sanitizeSupabaseUrl(rawUrl);
export const SUPABASE_ANON_KEY: string = sanitizeSupabaseKey(rawKey);

function createSafeSupabaseClient(): SupabaseClient {
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('Erro ao inicializar Supabase com variáveis de ambiente, usando fallback padrão:', err);
    return createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
}

export const supabase: SupabaseClient = createSafeSupabaseClient();

/**
 * Converte um usuário do Supabase Auth para a estrutura de User do SISBEM
 */
export function mapSupabaseUserToAppUser(su: any): {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO';
  crmv?: string;
  matricula?: string;
} {
  const meta = su.user_metadata || {};
  let role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO' = 'ADMIN';
  if (meta.role === 'VETERINARIO' || meta.role === 'OPERATOR' || meta.role === 'ADMIN') {
    role = meta.role;
  }
  return {
    id: su.id,
    name: meta.name || meta.full_name || su.email?.split('@')[0] || 'Usuário Supabase',
    username: su.email || su.id,
    role,
    crmv: meta.crmv || undefined,
    matricula: meta.matricula || undefined,
  };
}

/**
 * Autentica usuário via Supabase Auth
 */
export async function authenticateWithSupabase(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message, code: (error as any).code || '' };
    }

    if (!data.user) {
      return { success: false, error: 'Nenhum usuário retornado pelo Supabase.' };
    }

    const appUser = mapSupabaseUserToAppUser(data.user);
    return { success: true, user: appUser, session: data.session };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha na requisição ao Supabase' };
  }
}

/**
 * Cadastra um novo usuário no Supabase Auth
 */
export async function registerWithSupabase(email: string, password: string, name: string, role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO' = 'ADMIN') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          full_name: name.trim(),
          role,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const hasSession = Boolean(data.session);
    const user = data.user ? mapSupabaseUserToAppUser(data.user) : null;
    return {
      success: true,
      user,
      hasSession,
      needsEmailConfirmation: !hasSession && Boolean(data.user && !data.user.confirmed_at && !data.user.email_confirmed_at),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao registrar no Supabase' };
  }
}

/**
 * Reenvia e-mail de confirmação de cadastro do Supabase
 */
export async function resendSupabaseConfirmation(email: string) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao reenviar e-mail de confirmação' };
  }
}

/**
 * Envia e-mail de redefinição de senha do Supabase
 */
export async function resetSupabasePassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao solicitar recuperação de senha' };
  }
}

/**
 * Função utilitária para testar status de conexão com o Supabase
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const { data, error } = await supabase.from('animals').select('id', { count: 'exact', head: true });
    if (error) {
      return {
        success: false,
        message: error.message || 'Erro ao consultar tabela no Supabase',
        details: error,
      };
    }
    return {
      success: true,
      message: 'Conexão com o Supabase estabelecida com sucesso!',
      details: { count: data },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha de rede ao conectar com Supabase',
      details: err,
    };
  }
}
