import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function tryParseJsonString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    !(trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith('"'))
  ) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function formatExpandedCellValue(value: unknown): {
  text: string;
  mode: "json" | "text";
} {
  if (value === null || value === undefined) {
    return { text: "NULL", mode: "text" };
  }

  if (typeof value === "object") {
    try {
      return { text: JSON.stringify(value, null, 2), mode: "json" };
    } catch {
      return { text: String(value), mode: "text" };
    }
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  const parsedJson = tryParseJsonString(text);
  if (parsedJson !== null) {
    return { text: JSON.stringify(parsedJson, null, 2), mode: "json" };
  }

  return { text, mode: "text" };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function exportToCsv(
  columns: string[],
  rows: Record<string, unknown>[]
): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.map(escape).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
