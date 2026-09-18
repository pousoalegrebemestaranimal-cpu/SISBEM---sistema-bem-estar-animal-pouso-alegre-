import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { animals, kennels, clinicalRecords, surgeries, users } from './src/db/schema.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
