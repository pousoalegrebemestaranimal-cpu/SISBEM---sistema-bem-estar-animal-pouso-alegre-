import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './supabase.ts';

let cachedServerAdminClient: SupabaseClient | null = null;

/**
 * Retorna o cliente Supabase administrativo exclusivo do servidor,
 * inicializado com a variável SUPABASE_SERVICE_ROLE_KEY.
 *
 * REGRAS DE SEGURANÇA:
 * 1. Este cliente é exclusivo do ambiente de execução do Node.js (server-side).
 * 2. NUNCA importar este módulo no código cliente do navegador.
 * 3. Se SUPABASE_SERVICE_ROLE_KEY não estiver configurada no ambiente, retorna null,
 *    garantindo que operações de sincronização não usem credenciais anônimas inadequadas.
 */
export function getServerSupabaseAdminClient(): SupabaseClient | null {
  if (cachedServerAdminClient) {
    return cachedServerAdminClient;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return null;
  }

  try {
    cachedServerAdminClient = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedServerAdminClient;
  } catch (err: any) {
    console.error('[serverSupabase] Erro ao inicializar cliente administrativo com service_role:', err?.message || err);
    return null;
  }
}
