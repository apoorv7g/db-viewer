import { useCallback, useSyncExternalStore } from "react";
import { describeFilter, filtersEqual } from "@/lib/filters";
import type { TableFilter, TableView } from "@/types/database";

/**
 * Views are created automatically from the sort/filters the user applies and
 * listed under their table in the sidebar. They live in localStorage, scoped to
 * host + database so they never leak across databases, and are shared between
 * the sidebar and the grid through a tiny external store.
 */

type ViewsByTable = Record<string, TableView[]>;

export interface ViewState {
  filters: TableFilter[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}

const CHANGE_EVENT = "db-viewer-views-changed";
const EMPTY: ViewsByTable = {};
const cache = new Map<string, { raw: string | null; parsed: ViewsByTable }>();
const MAX_VIEWS_PER_TABLE = 20;

const storageKey = (scope: string) => `db-viewer-views:${scope}`;
export const tableKey = (schema: string, name: string) => `${schema}.${name}`;

function isView(v: unknown): v is TableView {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.filters)
  );
}

function read(scope: string): ViewsByTable {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey(scope));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(scope);
  if (hit && hit.raw === raw) return hit.parsed;

  let parsed: ViewsByTable = EMPTY;
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (data && typeof data === "object" && !Array.isArray(data)) {
      parsed = {};
      for (const [k, list] of Object.entries(data)) {
        if (Array.isArray(list)) parsed[k] = list.filter(isView);
      }
    }
  } catch {
    parsed = EMPTY;
  }
  cache.set(scope, { raw, parsed });
  return parsed;
}

function write(scope: string, next: ViewsByTable) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    // storage unavailable/full: views just won't persist
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function isDefaultState(state: ViewState) {
  return state.filters.length === 0 && !state.sortColumn;
}

export function stateEquals(a: ViewState, b: ViewState) {
  return (
    filtersEqual(a.filters, b.filters) &&
    a.sortColumn === b.sortColumn &&
    (a.sortColumn === undefined ||
      (a.sortDirection ?? "asc") === (b.sortDirection ?? "asc"))
  );
}

export function viewName(state: ViewState) {
  const parts: string[] = [];
  if (state.filters.length > 0) {
    parts.push(state.filters.map(describeFilter).join(", "));
  }
  if (state.sortColumn) {
    parts.push(
      `${state.sortColumn} ${(state.sortDirection ?? "asc").toUpperCase()}`
    );
  }
  return parts.join(" · ");
}

export function getView(scope: string, key: string, id: string | null) {
  if (!id) return null;
  return read(scope)[key]?.find((v) => v.id === id) ?? null;
}

/** Returns the existing view with this exact state, or creates one. */
export function ensureView(scope: string, key: string, state: ViewState) {
  const all = read(scope);
  const list = all[key] ?? [];
  const existing = list.find((v) => stateEquals(v, state));
  if (existing) return existing;

  const created: TableView = {
    id: crypto.randomUUID(),
    name: viewName(state),
    filters: state.filters,
    sortColumn: state.sortColumn,
    sortDirection: state.sortColumn ? state.sortDirection ?? "asc" : undefined,
  };
  // Oldest views fall off once the table has too many.
  const next = [...list, created].slice(-MAX_VIEWS_PER_TABLE);
  write(scope, { ...all, [key]: next });
  return created;
}

export function deleteView(scope: string, key: string, id: string) {
  const all = read(scope);
  write(scope, { ...all, [key]: (all[key] ?? []).filter((v) => v.id !== id) });
}

export function useViewsByTable(scope: string): ViewsByTable {
  const getSnapshot = useCallback(() => read(scope), [scope]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
