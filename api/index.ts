import app from '../server.ts';

/**
 * Vercel Serverless Function entry point for SISBEM backend API.
 * Delegates all /api/* requests to the Express application.
 */
export default function handler(req: any, res: any) {
  // Se o rewrite da Vercel remover o prefixo /api, restaura para casar com as rotas Express
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }
  return app(req, res);
}
