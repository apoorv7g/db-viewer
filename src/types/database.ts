export interface ConnectionConfig {
  uri: string;
  readOnly?: boolean;
  queryTimeoutMs?: number;
  resultLimit?: number;
}

export interface ConnectionSession {
  id: string;
  database: string;
  host: string;
  readOnly: boolean;
  queryTimeoutMs: number;
  resultLimit: number;
  connectedAt: number;
}

export interface DatabaseInfo {
  name: string;
  owner: string;
  sizeBytes: number | null;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view";
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  characterMaximumLength: number | null;
}

export interface TableSchema {
  tableName: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
}

export interface PaginatedData {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  columns: string[];
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID: number }[];
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface SqlSafetyAnalysis {
  isDestructive: boolean;
  operations: string[];
  requiresConfirmation: boolean;
  message?: string;
}

export type DataOperation = "insert" | "update" | "delete";
