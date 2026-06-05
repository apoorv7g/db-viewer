import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { randomUUID } from "crypto";
import type { ConnectionConfig, ConnectionSession } from "@/types/database";

const MAX_POOLS = 50;
const POOL_MAX_CONNECTIONS = 5;
const SESSION_TTL_MS = 30 * 60 * 1000;

interface PoolEntry {
  pool: Pool;
  session: ConnectionSession;
  lastUsed: number;
}

const pools = new Map<string, PoolEntry>();

function parseUri(uri: string): { host: string; database: string } {
  const url = new URL(uri);
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
  };
}

function cleanupStalePools() {
  const now = Date.now();
  for (const [id, entry] of pools) {
    if (now - entry.lastUsed > SESSION_TTL_MS) {
      entry.pool.end().catch(() => {});
      pools.delete(id);
    }
  }
}

export function getConnectionId(request: Request): string | null {
  return request.headers.get("X-Connection-Id");
}

export function getPoolEntry(connectionId: string): PoolEntry | null {
  const entry = pools.get(connectionId);
  if (!entry) return null;
  entry.lastUsed = Date.now();
  return entry;
}

export async function createConnection(
  config: ConnectionConfig
): Promise<ConnectionSession> {
  cleanupStalePools();

  if (pools.size >= MAX_POOLS) {
    throw new Error("Maximum connection limit reached. Please disconnect unused sessions.");
  }

  const { host, database } = parseUri(config.uri);
  const readOnly = config.readOnly ?? false;
  const queryTimeoutMs = config.queryTimeoutMs ?? 30000;
  const resultLimit = config.resultLimit ?? 1000;

  const pool = new Pool({
    connectionString: config.uri,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: queryTimeoutMs,
    query_timeout: queryTimeoutMs,
    application_name: "db-viewer",
  });

  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    if (readOnly) {
      await client.query("SET default_transaction_read_only = on");
    }
  } finally {
    client.release();
  }

  const id = randomUUID();
  const session: ConnectionSession = {
    id,
    database,
    host,
    readOnly,
    queryTimeoutMs,
    resultLimit,
    connectedAt: Date.now(),
  };

  pools.set(id, { pool, session, lastUsed: Date.now() });
  return session;
}

export async function testConnection(uri: string): Promise<{ ok: boolean; error?: string }> {
  const pool = new Pool({
    connectionString: uri,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT version()");
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, error: message };
  } finally {
    await pool.end();
  }
}

export async function disconnect(connectionId: string): Promise<boolean> {
  const entry = pools.get(connectionId);
  if (!entry) return false;

  // Guard against double-ending the same pool, which pg does not allow.
  if ((entry.pool as any).ended) {
    pools.delete(connectionId);
    return false;
  }

  try {
    await entry.pool.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.includes("Called end on pool more than once")) {
      throw err;
    }
  }
  pools.delete(connectionId);
  return true;
}

export async function withClient<T>(
  connectionId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const entry = getPoolEntry(connectionId);
  if (!entry) {
    throw new Error("Not connected. Please connect to a database first.");
  }
  const client = await entry.pool.connect();
  try {
    if (entry.session.readOnly) {
      await client.query("SET TRANSACTION READ ONLY");
    }
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  connectionId: string,
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number; fields: { name: string; dataTypeID: number }[] }> {
  return withClient(connectionId, async (client) => {
    const result = await client.query<T>(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      fields: result.fields.map((f) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
    };
  });
}

export function assertWritable(session: ConnectionSession) {
  if (session.readOnly) {
    throw new Error("Connection is in read-only mode. Write operations are not allowed.");
  }
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function qualifiedTable(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}
