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
 * Verifica assinatura e expiração do token
 */
export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  if (signature !== expectedSig) {
    return null;
  }

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

  // Validação no banco de dados Cloud SQL (Garante que usuário existe e papel confere)
  try {
    const pool = createPool();
    const userRes = await pool.query(
      'SELECT id, username, role, name FROM public.users WHERE id = $1 LIMIT 1;',
      [payload.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Usuário não localizado no banco de dados.',
      });
    }

    const dbUser = userRes.rows[0];
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      name: dbUser.name,
    };

    next();
  } catch (err: any) {
    console.error('Erro na verificação de autenticação no banco:', err);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Falha interna ao validar credenciais.',
    });
  }
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
