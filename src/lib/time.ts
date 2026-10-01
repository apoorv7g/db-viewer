import type { ColumnInfo } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  int2: "smallint",
  int4: "integer",
  int8: "bigint",
  float4: "real",
  float8: "double precision",
  bool: "boolean",
  bpchar: "char",
  varchar: "varchar",
  timestamptz: "timestamptz",
  timestamp: "timestamp",
  timetz: "timetz",
  numeric: "numeric",
};

/** Postgres internal type name (udt_name) -> the name people actually write. */
export function formatTypeName(udtName: string): string {
  if (udtName.startsWith("_")) return `${formatTypeName(udtName.slice(1))}[]`;
  return TYPE_LABELS[udtName.toLowerCase()] ?? udtName;
}

const INTEGER_TYPES = new Set(["int2", "int4", "int8", "numeric"]);
const TIMESTAMP_TYPES = new Set(["timestamp", "timestamptz"]);
const TIME_NAME_HINT =
  /(time|date|epoch|stamp|expir|since|until|_at$|at$|^ts$|_ts$)/i;

export type TimeKind = "epoch" | "timestamp";

/** Cheap check so only plausible time columns get hover handling. */
export function timeKindForColumn(column?: ColumnInfo): TimeKind | null {
  if (!column) return null;
  const udt = column.udtName.toLowerCase();
  if (TIMESTAMP_TYPES.has(udt)) return "timestamp";
  if (INTEGER_TYPES.has(udt) && TIME_NAME_HINT.test(column.name)) return "epoch";
  return null;
}

const IST_PARTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

function format(date: Date, timeZone: string, withMs: boolean) {
  const base = new Intl.DateTimeFormat("en-GB", { ...IST_PARTS, timeZone }).format(
    date
  );
  if (!withMs) return base;
  return `${base}.${String(date.getUTCMilliseconds()).padStart(3, "0")}`;
}

export interface ConvertedTime {
  ist: string;
  utc: string;
  note: string;
}

function toConverted(date: Date, withMs: boolean, note: string): ConvertedTime | null {
  if (Number.isNaN(date.getTime())) return null;
  return {
    ist: `${format(date, "Asia/Kolkata", withMs)} IST`,
    utc: `${format(date, "UTC", withMs)} UTC`,
    note,
  };
}

/**
 * Converts a cell value to IST. Epoch integers are interpreted by magnitude
 * (seconds / ms / µs / ns); timestamp columns are parsed as dates. Returns null
 * when the value doesn't look like a time. Only call this on hover.
 */
export function convertToIst(value: unknown, kind: TimeKind): ConvertedTime | null {
  if (value === null || value === undefined) return null;

  if (kind === "timestamp") {
    const date = value instanceof Date ? value : new Date(String(value));
    return toConverted(date, true, "timestamp");
  }

  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1e9 && abs < 1e11) {
    return toConverted(new Date(n * 1000), false, "epoch seconds");
  }
  if (abs >= 1e11 && abs < 1e14) {
    return toConverted(new Date(n), true, "epoch milliseconds");
  }
  if (abs >= 1e14 && abs < 1e17) {
    return toConverted(new Date(n / 1000), true, "epoch microseconds");
  }
  if (abs >= 1e17 && abs < 1e20) {
    return toConverted(new Date(n / 1e6), true, "epoch nanoseconds");
  }
  return null;
}
