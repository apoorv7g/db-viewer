import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { randomUUID } from "crypto";
import type { ConnectionConfig, ConnectionSession, DatabaseInfo } from "@/types/database";
import { withDatabase } from "@/lib/uri";

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

async function queryDatabaseList(client: PoolClient): Promise<DatabaseInfo[]> {
  const result = await client.query<{ datname: string; owner: string }>(
    `SELECT datname, pg_catalog.pg_get_userbyid(datdba) AS owner
     FROM pg_database
     WHERE datistemplate = false AND datallowconn = true
     ORDER BY datname ASC`
  );

  // pg_database_size() throws for databases the current role can't
  // connect to (common on managed providers), which would otherwise
  // abort the whole query. Fetch sizes separately and degrade gracefully.
  const sizes = new Map<string, number>();
  try {
    const sizeResult = await client.query<{ datname: string; size_bytes: string }>(
      `SELECT datname, pg_database_size(datname) AS size_bytes
       FROM pg_database
       WHERE datistemplate = false AND datallowconn = true`
    );
    for (const row of sizeResult.rows) {
      sizes.set(row.datname, Number(row.size_bytes));
    }
  } catch {
    // leave sizes empty
  }

  return result.rows.map((row) => ({
    name: row.datname,
    owner: row.owner,
    sizeBytes: sizes.get(row.datname) ?? null,
  }));
}

export async function listDatabases(uri: string): Promise<DatabaseInfo[]> {
  const pool = new Pool({
    connectionString: uri,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const client = await pool.connect();
    try {
      return await queryDatabaseList(client);
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list databases";
    throw new Error(message);
  } finally {
    await pool.end();
  }
}

export async function listDatabasesForConnection(
  connectionId: string
): Promise<DatabaseInfo[]> {
  const entry = getPoolEntry(connectionId);
  if (!entry) {
    throw new Error("Not connected. Please connect to a database first.");
  }
  const client = await entry.pool.connect();
  try {
    return await queryDatabaseList(client);
  } finally {
    client.release();
  }
}

export async function switchDatabase(
  connectionId: string,
  databaseName: string
): Promise<ConnectionSession> {
  const entry = getPoolEntry(connectionId);
  if (!entry) {
    throw new Error("Not connected. Please connect to a database first.");
  }

  const connectionString = (entry.pool.options as { connectionString?: string })
    .connectionString;
  if (!connectionString) {
    throw new Error("Unable to determine connection URI for this session.");
  }

  const oldSession = entry.session;
  const targetUri = withDatabase(connectionString, databaseName);

  const pool = new Pool({
    connectionString: targetUri,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: oldSession.queryTimeoutMs,
    query_timeout: oldSession.queryTimeoutMs,
    application_name: "db-viewer",
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      if (oldSession.readOnly) {
        await client.query("SET default_transaction_read_only = on");
      }
    } finally {
      client.release();
    }
  } catch (err) {
    await pool.end().catch(() => {});
    const message = err instanceof Error ? err.message : "Failed to switch database";
    throw new Error(message);
  }

  const { database } = parseUri(targetUri);
  const session: ConnectionSession = {
    ...oldSession,
    database,
    connectedAt: Date.now(),
  };

  pools.set(connectionId, { pool, session, lastUsed: Date.now() });
  await entry.pool.end().catch(() => {});

  return session;
}

export async function disconnect(connectionId: string): Promise<boolean> {
  const entry = pools.get(connectionId);
  if (!entry) return false;

  // Guard against double-ending the same pool, which pg does not allow.
  if ((entry.pool as unknown as { ended?: boolean }).ended) {
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
