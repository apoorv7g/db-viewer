import {
  query,
  quoteIdent,
  qualifiedTable,
  withClient,
} from "@/lib/database";
import type { ColumnInfo, PaginatedData, TableInfo, TableSchema } from "@/types/database";

export async function listTables(
  connectionId: string,
  search?: string
): Promise<TableInfo[]> {
  const sql = `
    SELECT
      t.table_schema AS schema,
      t.table_name AS name,
      t.table_type AS type
    FROM information_schema.tables t
    WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND t.table_type IN ('BASE TABLE', 'VIEW')
      ${search ? `AND (t.table_name ILIKE $1 OR t.table_schema ILIKE $1)` : ""}
    ORDER BY t.table_schema, t.table_name
  `;
  const params = search ? [`%${search}%`] : [];
  const { rows } = await query<{
    schema: string;
    name: string;
    type: string;
  }>(connectionId, sql, params);

  const tables: TableInfo[] = [];
  for (const row of rows) {
    let rowCount: number | undefined;
    if (row.type === "BASE TABLE") {
      try {
        const countResult = await query<{ count: string }>(
          connectionId,
          `SELECT COUNT(*)::text AS count FROM ${qualifiedTable(row.schema, row.name)}`
        );
        rowCount = parseInt(countResult.rows[0]?.count ?? "0", 10);
      } catch {
        rowCount = undefined;
      }
    }
    tables.push({
      schema: row.schema,
      name: row.name,
      type: row.type === "VIEW" ? "view" : "table",
      rowCount,
    });
  }
  return tables;
}

export async function getTableSchema(
  connectionId: string,
  tableName: string,
  schema = "public"
): Promise<TableSchema> {
  const columnsSql = `
    SELECT
      c.column_name AS name,
      c.data_type AS "dataType",
      c.udt_name AS "udtName",
      c.is_nullable = 'YES' AS "isNullable",
      c.column_default AS "columnDefault",
      c.character_maximum_length AS "characterMaximumLength",
      COALESCE(pk.is_pk, false) AS "isPrimaryKey"
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT ku.column_name, true AS is_pk
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    ) pk ON pk.column_name = c.column_name
    WHERE c.table_schema = $1 AND c.table_name = $2
    ORDER BY c.ordinal_position
  `;
  const { rows } = await query<ColumnInfo>(connectionId, columnsSql, [
    schema,
    tableName,
  ]);
  const primaryKeys = rows.filter((c) => c.isPrimaryKey).map((c) => c.name);
  return { tableName, schema, columns: rows, primaryKeys };
}

export async function getTableData(
  connectionId: string,
  tableName: string,
  options: {
    schema?: string;
    page?: number;
    pageSize?: number;
    sortColumn?: string;
    sortDirection?: "asc" | "desc";
    filterColumn?: string;
    filterValue?: string;
  }
): Promise<PaginatedData> {
  const schema = options.schema ?? "public";
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const tableSchema = await getTableSchema(connectionId, tableName, schema);
  const columnNames = tableSchema.columns.map((c) => c.name);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.filterColumn && options.filterValue !== undefined) {
    if (!columnNames.includes(options.filterColumn)) {
      throw new Error("Invalid filter column");
    }
    conditions.push(
      `${quoteIdent(options.filterColumn)}::text ILIKE $${paramIndex}`
    );
    params.push(`%${options.filterValue}%`);
    paramIndex++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderClause = "";
  if (options.sortColumn && columnNames.includes(options.sortColumn)) {
    const dir = options.sortDirection === "desc" ? "DESC" : "ASC";
    orderClause = `ORDER BY ${quoteIdent(options.sortColumn)} ${dir}`;
  } else if (tableSchema.primaryKeys.length > 0) {
    orderClause = `ORDER BY ${tableSchema.primaryKeys.map(quoteIdent).join(", ")}`;
  }

  const tableRef = qualifiedTable(schema, tableName);

  const countSql = `SELECT COUNT(*)::int AS total FROM ${tableRef} ${whereClause}`;
  const dataSql = `SELECT * FROM ${tableRef} ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  params.push(pageSize, offset);

  const [countResult, dataResult] = await Promise.all([
    query<{ total: number }>(
      connectionId,
      countSql,
      params.slice(0, paramIndex - 1)
    ),
    query(connectionId, dataSql, params),
  ]);

  return {
    rows: dataResult.rows as Record<string, unknown>[],
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
    columns: dataResult.fields.map((f) => f.name),
  };
}

export async function insertRows(
  connectionId: string,
  tableName: string,
  rows: Record<string, unknown>[],
  schema = "public"
): Promise<number> {
  if (rows.length === 0) return 0;
  const tableSchema = await getTableSchema(connectionId, tableName, schema);
  const validColumns = new Set(tableSchema.columns.map((c) => c.name));

  return withClient(connectionId, async (client) => {
    let inserted = 0;
    for (const row of rows) {
      const entries = Object.entries(row).filter(
        ([k]) => validColumns.has(k) && row[k] !== undefined
      );
      if (entries.length === 0) continue;

      const cols = entries.map(([k]) => quoteIdent(k));
      const placeholders = entries.map((_, i) => `$${i + 1}`);
      const values = entries.map(([, v]) => (v === "" ? null : v));

      const sql = `INSERT INTO ${qualifiedTable(schema, tableName)} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;
      const result = await client.query(sql, values);
      inserted += result.rowCount ?? 1;
    }
    return inserted;
  });
}

export async function updateRows(
  connectionId: string,
  tableName: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>,
  schema = "public"
): Promise<number> {
  const tableSchema = await getTableSchema(connectionId, tableName, schema);
  const validColumns = new Set(tableSchema.columns.map((c) => c.name));

  const setEntries = Object.entries(data).filter(
    ([k]) => validColumns.has(k) && !tableSchema.primaryKeys.includes(k)
  );
  const whereEntries = Object.entries(where).filter(([k]) =>
    validColumns.has(k)
  );

  if (setEntries.length === 0) throw new Error("No valid columns to update");
  if (whereEntries.length === 0) throw new Error("WHERE clause required");

  const params: unknown[] = [];
  let i = 1;

  const setClause = setEntries
    .map(([k, v]) => {
      params.push(v === "" ? null : v);
      return `${quoteIdent(k)} = $${i++}`;
    })
    .join(", ");

  const whereClause = whereEntries
    .map(([k, v]) => {
      params.push(v);
      return `${quoteIdent(k)} = $${i++}`;
    })
    .join(" AND ");

  const sql = `UPDATE ${qualifiedTable(schema, tableName)} SET ${setClause} WHERE ${whereClause}`;
  const result = await query(connectionId, sql, params);
  return result.rowCount;
}

export async function deleteRows(
  connectionId: string,
  tableName: string,
  whereList: Record<string, unknown>[],
  schema = "public"
): Promise<number> {
  const tableSchema = await getTableSchema(connectionId, tableName, schema);
  const validColumns = new Set(tableSchema.columns.map((c) => c.name));

  return withClient(connectionId, async (client) => {
    let deleted = 0;
    for (const where of whereList) {
      const whereEntries = Object.entries(where).filter(([k]) =>
        validColumns.has(k)
      );
      if (whereEntries.length === 0) continue;

      const params: unknown[] = [];
      const whereClause = whereEntries
        .map(([k, v], idx) => {
          params.push(v);
          return `${quoteIdent(k)} = $${idx + 1}`;
        })
        .join(" AND ");

      const sql = `DELETE FROM ${qualifiedTable(schema, tableName)} WHERE ${whereClause}`;
      const result = await client.query(sql, params);
      deleted += result.rowCount ?? 0;
    }
    return deleted;
  });
}

export function detectSoftDeleteColumn(columns: ColumnInfo[]): string | null {
  const names = ["deleted_at", "is_deleted", "deleted", "archived_at"];
  for (const col of columns) {
    if (names.includes(col.name.toLowerCase())) return col.name;
  }
  return null;
}
