import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, createPool } from './src/db/index.ts';
import { animals, kennels, clinicalRecords, surgeries, users } from './src/db/schema.ts';
import { createAuthToken, requireAuth, requireRoles, AuthenticatedRequest } from './src/lib/serverAuth.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Emissão de Token de Autenticação Seguro baseado na identidade do banco
  app.post('/api/auth/token', async (req, res) => {
    const { userId, username, password } = req.body;
    const pool = createPool();

    try {
      let query = 'SELECT id, username, role, name, uid FROM public.users WHERE ';
      const params: any[] = [];

      if (userId) {
        query += 'id = $1 LIMIT 1;';
        params.push(userId);
      } else if (username) {
        query += 'LOWER(username) = LOWER($1) LIMIT 1;';
        params.push(username);
      } else {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'userId ou username é obrigatório para emissão de token.',
        });
      }

      const userRes = await pool.query(query, params);
      if (userRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não localizado no sistema.',
        });
      }

      const dbUser = userRes.rows[0];
      const token = createAuthToken({
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        name: dbUser.name,
      });

      return res.json({
        success: true,
        token,
        user: {
          id: dbUser.id,
          username: dbUser.username,
          role: dbUser.role,
          name: dbUser.name,
        },
      });
    } catch (err: any) {
      console.error('Erro na emissão de token de autenticação:', err);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro interno ao processar autenticação.',
      });
    }
  });

  // Database Connection Status & Diagnostics
  app.get('/api/db/status', async (req, res) => {
    try {
      const allUsers = await db.select().from(users).limit(5);
      const allKennels = await db.select().from(kennels).limit(5);
      res.json({
        connected: true,
        database: process.env.SQL_DB_NAME || 'cloudsql',
        sampleUsersCount: allUsers.length,
        sampleKennelsCount: allKennels.length,
      });
    } catch (error: any) {
      console.error('Database diagnostic check error:', error);
      res.status(500).json({
        connected: false,
        error: error.message || 'Database connection error',
      });
    }
  });

  // Supabase Configuration & Status Endpoint
  app.get('/api/supabase/status', (req, res) => {
    let rawUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://azufmdknlvbfaxnfiwwg.supabase.co';
    if (rawUrl.includes('=')) {
      rawUrl = rawUrl.split('=').pop()?.trim() || rawUrl;
    }
    rawUrl = rawUrl.replace(/^["']+|["']+$/g, '').trim();

    let rawKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JFhiLBJSwxMatR7YIl51nA_T7bt6Xe4';
    if (rawKey.includes('=')) {
      rawKey = rawKey.split('=').pop()?.trim() || rawKey;
    }
    rawKey = rawKey.replace(/^["']+|["']+$/g, '').trim();

    res.json({
      configured: true,
      url: rawUrl,
      projectId: 'azufmdknlvbfaxnfiwwg',
      hasAnonKey: Boolean(rawKey),
      keyPreview: `${rawKey.substring(0, 16)}...`,
    });
  });

  // Endpoints para sincronização de dados com PostgreSQL / Supabase
  app.get('/api/animals', async (req, res) => {
    try {
      const data = await db.select().from(animals);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch animals from DB:', error);
      res.status(500).json({ error: 'Erro ao buscar animais do banco' });
    }
  });

  app.get('/api/kennels', async (req, res) => {
    try {
      const data = await db.select().from(kennels);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch kennels from DB:', error);
      res.status(500).json({ error: 'Erro ao buscar baias do banco' });
    }
  });

  app.get('/api/surgeries', async (req, res) => {
    try {
      const data = await db.select().from(surgeries);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch surgeries from DB:', error);
      res.status(500).json({ error: 'Erro ao buscar cirurgias do banco' });
    }
  });

  // Endpoints Transacionais para Atendimento Clínico (Protegidos com Autenticação e Autorização)
  app.post(
    '/api/attendance/start',
    requireAuth,
    requireRoles(['VETERINARIO', 'ADMIN']),
    async (req: AuthenticatedRequest, res) => {
      const { animalId, vetId } = req.body;
      const user = req.user!;

      if (!animalId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'animalId é obrigatório.',
        });
      }

      // Bloqueio rigoroso de impersonação: Usuário não-admin não pode assumir identidade alheia
      if (vetId && vetId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_VET',
          message: 'Tentativa de impersonação de veterinário bloqueada: o ID informado difere do usuário autenticado.',
        });
      }

      const targetVetId = user.role === 'ADMIN' && vetId ? vetId : user.id;
      const pool = createPool();

      try {
        const queryRes = await pool.query(
          'SELECT public.start_clinical_attendance($1, $2) AS result;',
          [animalId, targetVetId]
        );
        const result = queryRes.rows[0]?.result;
        return res.json(result || { success: false, code: 'INTERNAL_ERROR', message: 'Sem resposta da função de atendimento.' });
      } catch (err: any) {
        console.error('Erro na rota /api/attendance/start:', err);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'Falha interna ao processar início de atendimento veterinário.',
        });
      }
    }
  );

  app.post(
    '/api/attendance/cancel',
    requireAuth,
    requireRoles(['VETERINARIO', 'ADMIN']),
    async (req: AuthenticatedRequest, res) => {
      const { animalId, vetId, motivo } = req.body;
      const user = req.user!;

      if (!animalId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'animalId é obrigatório.',
        });
      }

      if (vetId && vetId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_VET',
          message: 'Tentativa de impersonação de veterinário bloqueada: o ID informado difere do usuário autenticado.',
        });
      }

      const targetVetId = user.role === 'ADMIN' && vetId ? vetId : user.id;
      const pool = createPool();

      try {
        const queryRes = await pool.query(
          'SELECT public.cancel_clinical_attendance($1, $2, $3) AS result;',
          [animalId, targetVetId, motivo || 'Cancelamento de atendimento']
        );
        const result = queryRes.rows[0]?.result;
        return res.json(result || { success: false, code: 'INTERNAL_ERROR', message: 'Sem resposta da função de cancelamento.' });
      } catch (err: any) {
        console.error('Erro na rota /api/attendance/cancel:', err);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'Falha interna ao processar cancelamento de atendimento.',
        });
      }
    }
  );

  app.post(
    '/api/attendance/finish',
    requireAuth,
    requireRoles(['VETERINARIO', 'ADMIN']),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const payload = req.body;

      if (!payload || !payload.record) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PAYLOAD',
          message: 'Dados do prontuário ausentes.',
        });
      }

      // Impede impersonação no corpo do prontuário
      if (
        payload.record.veterinarioId &&
        payload.record.veterinarioId !== user.id &&
        user.role !== 'ADMIN'
      ) {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_VET',
          message: 'Tentativa de impersonação de veterinário bloqueada: veterinarioId difere do usuário autenticado.',
        });
      }

      // Injeta a identidade canônica autenticada
      const targetVetId = user.role === 'ADMIN' && payload.record.veterinarioId ? payload.record.veterinarioId : user.id;
      payload.record.veterinarioId = targetVetId;
      payload.record.authenticatedVetId = user.id;

      const pool = createPool();
      try {
        const queryRes = await pool.query(
          'SELECT public.finish_clinical_attendance($1::jsonb) AS result;',
          [JSON.stringify(payload)]
        );
        const result = queryRes.rows[0]?.result;
        return res.json(result || { success: false, code: 'INTERNAL_ERROR', message: 'Sem resposta da função de finalização.' });
      } catch (err: any) {
        console.error('Erro na rota /api/attendance/finish:', err);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'Falha interna ao processar finalização transacional do atendimento.',
        });
      }
    }
  );

  // Vite middleware setup (Express v5 requires '*all')
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SISBEM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
