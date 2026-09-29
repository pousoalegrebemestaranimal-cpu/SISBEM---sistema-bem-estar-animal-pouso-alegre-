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
 * Converte um usuário do Supabase Auth para a estrutura de User do SISBEM com base nos metadados
 */
export function mapSupabaseUserToAppUser(su: any): {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO';
  crmv?: string;
  matricula?: string;
  email?: string;
} {
  const meta = su.user_metadata || {};
  let role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO' = 'ADMIN';
  if (meta.role === 'VETERINARIO' || meta.role === 'OPERATOR' || meta.role === 'ADMIN') {
    role = meta.role;
  }
  return {
    id: su.id,
    name: meta.name || meta.full_name || su.email?.split('@')[0] || 'Usuário Supabase',
    username: meta.username || su.email || su.id,
    role,
    crmv: meta.crmv || undefined,
    matricula: meta.matricula || undefined,
    email: su.email || undefined,
  };
}

/**
 * Resolve o perfil institucional canônico a partir da tabela public.users do Supabase,
 * preservando os IDs, CRMV, matrícula e papel cadastrados no sistema.
 */
export async function resolveSupabaseProfile(su: any): Promise<{
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO';
  crmv?: string;
  matricula?: string;
  email?: string;
}> {
  if (!su) return mapSupabaseUserToAppUser({});

  try {
    let query = supabase.from('users').select('id, name, username, email, role, crmv, matricula, uid');
    if (su.email) {
      query = query.or(`email.eq.${su.email},id.eq.${su.id},uid.eq.${su.id}`);
    } else {
      query = query.or(`id.eq.${su.id},uid.eq.${su.id}`);
    }

    const { data: profile } = await query.limit(1).maybeSingle();
    if (profile) {
      let role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO' = 'ADMIN';
      if (profile.role === 'VETERINARIO' || profile.role === 'OPERATOR' || profile.role === 'ADMIN') {
        role = profile.role;
      }
      return {
        id: profile.id, // Preserva o ID canônico institucional do SISBEM
        name: profile.name || su.user_metadata?.name || 'Usuário SISBEM',
        username: profile.username || su.email?.split('@')[0] || profile.name,
        role,
        crmv: profile.crmv || undefined,
        matricula: profile.matricula || undefined,
        email: profile.email || su.email || undefined,
      };
    }
  } catch (err) {
    console.warn('[Supabase Auth] Falha ao consultar perfil institucional em public.users:', err);
  }

  // Fallback para metadados da sessão Auth se o perfil ainda não estiver em public.users
  return mapSupabaseUserToAppUser(su);
}

/**
 * Traduz mensagens de erro do Supabase Auth para instruções claras em português
 */
export function formatSupabaseAuthError(error: any): string {
  if (!error) return 'Falha na autenticação.';
  const msg = typeof error === 'string' ? error : (error.message || '');
  const lower = msg.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Credenciais inválidas: e-mail/usuário ou senha incorretos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada e spam ou solicite o reenvio de confirmação.';
  }
  if (lower.includes('rate limit')) {
    return 'Limite de tentativas excedido temporariamente. Aguarde alguns instantes e tente novamente.';
  }
  if (lower.includes('user not found')) {
    return 'Conta de usuário não localizada no sistema.';
  }
  if (lower.includes('signup requires a valid password') || lower.includes('password should be at least')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (lower.includes('networkerror') || lower.includes('failed to fetch')) {
    return 'Falha de comunicação com o Supabase. Verifique sua conexão com a internet.';
  }

  return msg;
}

/**
 * Resolve o e-mail de acesso quando o usuário informa um username em vez de e-mail
 */
export async function resolveEmailFromIdentifier(identifier: string): Promise<string> {
  const clean = identifier.trim();
  if (clean.includes('@')) {
    return clean.toLowerCase();
  }

  try {
    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .ilike('username', clean)
      .limit(1)
      .maybeSingle();

    if (profile?.email && profile.email.includes('@')) {
      return profile.email.trim().toLowerCase();
    }
  } catch {
    // ignore
  }

  // Convenção padrão para nomes de usuário sem e-mail explícito
  return `${clean.toLowerCase()}@sisbem.gov.br`;
}

/**
 * Autentica usuário oficialmente via Supabase Auth (Fonte Oficial de Autenticação)
 */
export async function authenticateWithSupabase(identifier: string, password: string) {
  try {
    const emailToUse = await resolveEmailFromIdentifier(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error) {
      return { 
        success: false, 
        error: formatSupabaseAuthError(error), 
        rawError: error.message,
        code: (error as any).code || '' 
      };
    }

    if (!data.user) {
      return { success: false, error: 'Nenhum usuário retornado pelo Supabase Auth.' };
    }

    // Resolve o perfil institucional completo
    const appUser = await resolveSupabaseProfile(data.user);
    return { success: true, user: appUser, session: data.session };
  } catch (err: any) {
    return { success: false, error: formatSupabaseAuthError(err) };
  }
}

/**
 * Cadastra um novo usuário no Supabase Auth e insere perfil institucional em public.users
 */
export async function registerWithSupabase(
  email: string, 
  password: string, 
  name: string, 
  role: 'ADMIN' | 'OPERATOR' | 'VETERINARIO' = 'ADMIN',
  crmv?: string,
  matricula?: string,
  username?: string
) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const derivedUsername = (username || cleanEmail.split('@')[0] || cleanName).toLowerCase().replace(/[^a-z0-9._-]/g, '');

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
          full_name: cleanName,
          username: derivedUsername,
          role,
          crmv: crmv?.trim() || null,
          matricula: matricula?.trim() || null,
        },
      },
    });

    if (error) {
      return { success: false, error: formatSupabaseAuthError(error), rawError: error.message };
    }

    const hasSession = Boolean(data.session);
    let appUser = null;

    if (data.user) {
      appUser = await resolveSupabaseProfile(data.user);

      // Insere/atualiza registro institucional em public.users para consulta geral
      try {
        await supabase.from('users').upsert({
          id: data.user.id,
          uid: data.user.id,
          email: cleanEmail,
          name: cleanName,
          username: derivedUsername,
          role,
          crmv: crmv?.trim() || null,
          matricula: matricula?.trim() || null,
        }, { onConflict: 'id' });
      } catch (insertErr) {
        console.warn('[Supabase Auth] Aviso ao criar perfil em public.users:', insertErr);
      }
    }

    return {
      success: true,
      user: appUser,
      hasSession,
      needsEmailConfirmation: !hasSession && Boolean(data.user && !data.user.confirmed_at && !data.user.email_confirmed_at),
    };
  } catch (err: any) {
    return { success: false, error: formatSupabaseAuthError(err) };
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
