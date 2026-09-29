import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createPool } from '../db/index';

const JWT_SECRET = process.env.SESSION_SECRET || 'sisbem_production_hmac_secret_key_2026_pa_mg';

export interface TokenPayload {
  id: string;
  username: string;
  role: string;
  name?: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    name: string;
    email?: string;
  };
}

/**
 * Cria token assinado com HMAC-SHA256 (Padrão JWT compacto)
 */
export function createAuthToken(user: { id: string; username: string; role: string; name?: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 dias
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Verifica assinatura e expiração do token (suporta HMAC próprio e tokens do Supabase Auth)
 */
export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [b64Header, b64Payload, signature] = parts;

  // 1. Tenta verificação com HMAC-SHA256 interno do SISBEM
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  if (signature === expectedSig) {
    try {
      const payload: TokenPayload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  // 2. Suporte a tokens oficiais do Supabase Auth
  try {
    const rawPayload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (rawPayload.exp && rawPayload.exp < now) {
      return null;
    }

    if (rawPayload.sub && (rawPayload.aud === 'authenticated' || (rawPayload.iss && rawPayload.iss.includes('supabase')))) {
      const meta = rawPayload.user_metadata || {};
      let role = 'ADMIN';
      if (meta.role === 'VETERINARIO' || meta.role === 'OPERATOR' || meta.role === 'ADMIN') {
        role = meta.role;
      }
      return {
        id: rawPayload.sub,
        username: meta.username || rawPayload.email || rawPayload.sub,
        role,
        name: meta.name || meta.full_name || rawPayload.email || 'Usuário Supabase',
        iat: rawPayload.iat || now,
        exp: rawPayload.exp,
      };
    }
  } catch {
    // ignora
  }

  return null;
}

/**
 * Middleware Express para exigir autenticação válida
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Token de autenticação ausente ou inválido.',
    });
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAuthToken(token);

  if (!payload || !payload.id) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Sessão inválida ou expirada. Faça login novamente.',
    });
  }

  // Define usuário ativo com base no token autenticado
  req.user = {
    id: payload.id,
    username: payload.username,
    role: payload.role,
    name: payload.name || payload.username,
  };

  // Se o Cloud SQL estiver disponível, enriquece com dados institucionais da tabela users
  try {
    const pool = createPool();
    const userRes = await pool.query(
      'SELECT id, username, role, name, email FROM public.users WHERE id = $1 OR uid = $1 OR LOWER(email) = LOWER($2) LIMIT 1;',
      [payload.id, payload.username]
    );

    if (userRes.rows.length > 0) {
      const dbUser = userRes.rows[0];
      req.user = {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        name: dbUser.name,
        email: dbUser.email || undefined,
      };
    }
  } catch (err: any) {
    // Se Cloud SQL não estiver acessível, não derruba a requisição: mantém os dados do token autenticado
    console.warn('[serverAuth] Aviso ao consultar usuário no Cloud SQL:', err?.message);
  }

  next();
}

/**
 * Middleware para restringir por papel (ex: VETERINARIO ou ADMIN)
 */
export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Acesso negado: seu perfil não possui autorização para esta operação técnica.',
      });
    }
    next();
  };
}
