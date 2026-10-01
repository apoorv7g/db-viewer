import type { TableFilter } from "@/types/database";

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const likeText = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/** Mirrors the WHERE clause the server builds, but with values inlined. */
export function buildSelectSql(opts: {
  schema: string;
  table: string;
  filters: TableFilter[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  for (const f of opts.filters) {
    const col = ident(f.field);
    const text = f.value.trim();
    switch (f.op) {
      case "is_null":
        conditions.push(`${col} IS NULL`);
        break;
      case "is_not_null":
        conditions.push(`${col} IS NOT NULL`);
        break;
      default: {
        if (text === "") break;
        const like = likeText(text);
        if (f.op === "contains")
          conditions.push(`${col}::text ILIKE ${literal(`%${like}%`)}`);
        else if (f.op === "not_contains")
          conditions.push(
            `(${col} IS NULL OR ${col}::text NOT ILIKE ${literal(`%${like}%`)})`
          );
        else if (f.op === "starts_with")
          conditions.push(`${col}::text ILIKE ${literal(`${like}%`)}`);
        else if (f.op === "ends_with")
          conditions.push(`${col}::text ILIKE ${literal(`%${like}`)}`);
        else if (f.op === "equals")
          conditions.push(`${col}::text = ${literal(text)}`);
        else if (f.op === "not_equals")
          conditions.push(`(${col} IS NULL OR ${col}::text <> ${literal(text)})`);
        else {
          const op = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[f.op];
          conditions.push(`${col} ${op} ${literal(text)}`);
        }
      }
    }
  }

  const lines = [`SELECT * FROM ${ident(opts.schema)}.${ident(opts.table)}`];
  if (conditions.length > 0) lines.push(`WHERE ${conditions.join("\n  AND ")}`);
  if (opts.sortColumn) {
    lines.push(
      `ORDER BY ${ident(opts.sortColumn)} ${opts.sortDirection === "desc" ? "DESC" : "ASC"}`
    );
  }
  if (opts.limit !== undefined) lines.push(`LIMIT ${opts.limit}`);
  if (opts.offset) lines.push(`OFFSET ${opts.offset}`);
  return `${lines.join("\n")};`;
}
