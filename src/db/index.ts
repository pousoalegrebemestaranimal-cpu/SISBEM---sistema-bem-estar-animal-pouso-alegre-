import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { GoogleAuth } from 'google-auth-library';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads and warm serverless lambdas
declare global {
  var _postgresPool: Pool | undefined;
  var _postgresPoolPromise: Promise<Pool> | undefined;
  var _cloudSqlConnector: Connector | undefined;
}

/**
 * Remove qualquer senha, chave privada ou segredo de mensagens de erro antes de logar ou propagar.
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Erro de banco de dados';
  let safe = message;
  if (process.env.SQL_PASSWORD) {
    safe = safe.split(process.env.SQL_PASSWORD).join('***REDACTED***');
  }
  if (process.env.SESSION_SECRET) {
    safe = safe.split(process.env.SESSION_SECRET).join('***REDACTED***');
  }
  safe = safe.replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/gs, '***REDACTED_KEY***');
  return safe;
}

/**
 * Obtém ou cria o Pool de conexões do PostgreSQL de forma segura e assíncrona.
 * - Se CLOUD_SQL_CONNECTION_NAME estiver definido: usa @google-cloud/cloud-sql-connector com mTLS.
 * - Caso contrário: usa conexão direta TCP / Socket local (compatível com AI Studio).
 */
export async function getPool(): Promise<Pool> {
  // 1. Reutiliza pool ativo e válido em warm invocations
  if (global._postgresPool && !(global._postgresPool as any).ending && !(global._postgresPool as any).ended) {
    return global._postgresPool;
  }

  // 2. Se já houver inicialização em andamento, aguarda para evitar race condition
  if (global._postgresPoolPromise) {
    return global._postgresPoolPromise;
  }

  global._postgresPoolPromise = (async () => {
    try {
      const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
      const maxConnections = process.env.SQL_MAX_CONNECTIONS
        ? parseInt(process.env.SQL_MAX_CONNECTIONS, 10)
        : (isServerless ? 3 : 10);
      const idleTimeoutMillis = isServerless ? 10000 : 30000;
      const connectionTimeoutMillis = 10000;

      // MODALIDADE 1: Cloud SQL Node.js Connector (se CLOUD_SQL_CONNECTION_NAME estiver definido)
      if (process.env.CLOUD_SQL_CONNECTION_NAME) {
        const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME.trim();

        // Inicializa ou reutiliza o Connector global
        if (!global._cloudSqlConnector) {
          let auth: GoogleAuth | undefined = undefined;
          const saKey = process.env.GCP_SERVICE_ACCOUNT_KEY ||
                        process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
                        process.env.GOOGLE_CREDENTIALS;

          if (saKey) {
            try {
              const credentials = typeof saKey === 'string' ? JSON.parse(saKey) : saKey;
              auth = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/sqlservice.admin'],
              });
            } catch {
              console.error('[CloudSQL Connector] Falha ao processar credenciais da Service Account da variável de ambiente.');
            }
          }

          global._cloudSqlConnector = new Connector(auth ? { auth } : {});
        }

        const ipTypeEnv = (process.env.CLOUD_SQL_IP_TYPE || 'PUBLIC').toUpperCase();
        const ipType = ipTypeEnv === 'PRIVATE'
          ? IpAddressTypes.PRIVATE
          : ipTypeEnv === 'PSC'
          ? IpAddressTypes.PSC
          : IpAddressTypes.PUBLIC;

        const clientOpts = await global._cloudSqlConnector.getOptions({
          instanceConnectionName,
          ipType,
        });

        const newPool = new Pool({
          ...clientOpts,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: maxConnections,
          idleTimeoutMillis,
          connectionTimeoutMillis,
        });

        newPool.on('error', (err: any) => {
          console.error('[CloudSQL Pool Error]:', sanitizeErrorMessage(err?.message || 'Unexpected pool error'));
        });

        global._postgresPool = newPool;
        return newPool;
      }

      // MODALIDADE 2: Conexão Direta TCP / Unix Domain Socket (ambiente AI Studio / local)
      const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
      const useSsl = process.env.SQL_SSL === 'true' || process.env.SQL_SSL === 'require';

      const directPool = new Pool({
        host: process.env.SQL_HOST,
        port,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: maxConnections,
        connectionTimeoutMillis,
        idleTimeoutMillis,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      });

      directPool.on('error', (err: any) => {
        console.error('[SQL Pool Error]:', sanitizeErrorMessage(err?.message || 'Unexpected pool error'));
      });

      global._postgresPool = directPool;
      return directPool;
    } catch (err: any) {
      const safeMessage = sanitizeErrorMessage(err?.message || 'Erro ao inicializar pool do Cloud SQL');
      console.error('[CloudSQL Init Error]:', safeMessage);
      throw new Error(safeMessage);
    } finally {
      global._postgresPoolPromise = undefined;
    }
  })();

  return global._postgresPoolPromise;
}

/**
 * Subclasse de Pool que delega dinamicamente para o pool real instanciado via getPool().
 * Permite que chamadas síncronas existentes (ex: createPool().query(...)) funcionem
 * perfeitamente tanto no AI Studio (TCP direto) quanto na Vercel (Cloud SQL Connector).
 */
class ServerlessCloudSqlPool extends Pool {
  constructor() {
    super();
  }

  // @ts-ignore
  query(...args: any[]): any {
    const lastArg = args[args.length - 1];
    const hasCallback = typeof lastArg === 'function';

    const execute = async () => {
      const realPool = await getPool();
      return (realPool.query as any)(...args);
    };

    if (hasCallback) {
      execute().then(res => lastArg(null, res)).catch(err => lastArg(err));
      return;
    }

    return execute();
  }

  // @ts-ignore
  connect(...args: any[]): any {
    const callback = typeof args[0] === 'function' ? args[0] : undefined;

    const execute = async () => {
      const realPool = await getPool();
      return realPool.connect();
    };

    if (callback) {
      execute()
        .then(client => callback(null, client, (releaseErr: any) => client.release(releaseErr)))
        .catch(err => callback(err));
      return;
    }

    return execute();
  }

  // @ts-ignore
  end(callback?: any): any {
    if (global._postgresPool) {
      return (global._postgresPool.end as any)(callback);
    }
    if (typeof callback === 'function') {
      callback();
      return;
    }
    return Promise.resolve();
  }
}

/**
 * Cria ou recupera a instância do pool.
 * Mantém interface síncrona com suporte transparente para execução síncrona (AI Studio)
 * ou sob demanda com o Cloud SQL Connector.
 */
export const createPool = (): Pool => {
  // Se já houver pool instanciado no singleton global, retorna-o
  if (global._postgresPool && !(global._postgresPool as any).ending && !(global._postgresPool as any).ended) {
    return global._postgresPool;
  }

  // Em ambiente local sem Connector (AI Studio), instancia de forma síncrona imediatamente
  if (!process.env.CLOUD_SQL_CONNECTION_NAME && process.env.SQL_HOST) {
    const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    const maxConnections = process.env.SQL_MAX_CONNECTIONS
      ? parseInt(process.env.SQL_MAX_CONNECTIONS, 10)
      : (isServerless ? 3 : 10);
    const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
    const useSsl = process.env.SQL_SSL === 'true' || process.env.SQL_SSL === 'require';

    const pool = new Pool({
      host: process.env.SQL_HOST,
      port,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: maxConnections,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: isServerless ? 10000 : 30000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });

    pool.on('error', (err: any) => {
      console.error('[SQL Pool Error]:', sanitizeErrorMessage(err?.message || 'Unexpected pool error'));
    });

    global._postgresPool = pool;
    return pool;
  }

  // Instância inteligente que delega query/connect para getPool()
  return (new ServerlessCloudSqlPool()) as unknown as Pool;
};

// Instância canônica do pool
export const pool = createPool();

// Inicializa Drizzle com o pool e schema
export const db = drizzle(pool, { schema });
