/**
 * Utilitário de hash e verificação de credenciais para autenticação híbrida (Supabase + Local)
 */

export async function hashPassword(password: string, salt: string = 'sisbem_default'): Promise<string> {
  const cleanPass = (password || '').trim();
  const input = `sisbem_v1_${salt}_${cleanPass}`;
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return 'sb_sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // fallback
    }
  }

  // Fallback para ambientes sem crypto.subtle
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return 'sb_djb2:' + (hash >>> 0).toString(16);
}

export async function verifyPassword(password: string, salt: string, storedHash?: string | null): Promise<boolean> {
  if (!storedHash || typeof storedHash !== 'string') return false;
  
  // Se for hash gerado pelo sistema
  const computed = await hashPassword(password, salt);
  if (computed === storedHash) return true;

  // Suporte a hash com salt padrão
  const computedDefault = await hashPassword(password, 'sisbem_default');
  if (computedDefault === storedHash) return true;

  // Suporte a senhas em texto puro armazenadas no uid ou provisórias
  if (storedHash === password || storedHash === `plain:${password}`) return true;

  return false;
}
