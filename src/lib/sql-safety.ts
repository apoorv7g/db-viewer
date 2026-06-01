import type { SqlSafetyAnalysis } from "@/types/database";

const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|FUNCTION|TRIGGER|ROLE|USER)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+(OR\s+REPLACE\s+)?(TABLE|DATABASE|SCHEMA|INDEX|VIEW)\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
];

const HIGH_RISK_PATTERNS = [
  /\bDELETE\s+FROM\s+\w+\s*;?\s*$/i,
  /\bUPDATE\s+\w+\s+SET\s+[^;]+\s*;?\s*$/i,
];

export function analyzeSql(sql: string): SqlSafetyAnalysis {
  const trimmed = sql.trim();
  const operations: string[] = [];

  if (/\bDROP\b/i.test(trimmed)) operations.push("DROP");
  if (/\bDELETE\b/i.test(trimmed)) operations.push("DELETE");
  if (/\bUPDATE\b/i.test(trimmed)) operations.push("UPDATE");
  if (/\bTRUNCATE\b/i.test(trimmed)) operations.push("TRUNCATE");
  if (/\bALTER\b/i.test(trimmed)) operations.push("ALTER");
  if (/\bINSERT\b/i.test(trimmed)) operations.push("INSERT");
  if (/\bCREATE\b/i.test(trimmed)) operations.push("CREATE");

  const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(trimmed));
  const isHighRisk = HIGH_RISK_PATTERNS.some((p) => p.test(trimmed));

  let message: string | undefined;
  if (isDestructive) {
    message = `This query contains potentially destructive operations: ${operations.join(", ")}. Please confirm before executing.`;
  } else if (isHighRisk) {
    message =
      "This query may affect many rows (no WHERE clause detected). Please confirm before executing.";
  }

  return {
    isDestructive: isDestructive || isHighRisk,
    operations,
    requiresConfirmation: isDestructive || isHighRisk,
    message,
  };
}

export function isReadOnlyQuery(sql: string): boolean {
  const trimmed = sql.trim().replace(/^\(\s*|\s*\)$/g, "");
  const withoutComments = trimmed
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  return statements.every((stmt) => {
    const upper = stmt.toUpperCase();
    return (
      upper.startsWith("SELECT") ||
      upper.startsWith("WITH") ||
      upper.startsWith("EXPLAIN") ||
      upper.startsWith("SHOW")
    );
  });
}

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
}
