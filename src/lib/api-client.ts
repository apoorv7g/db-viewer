import type { DatabaseInfo } from "@/types/database";

const CONNECTION_KEY = "db-viewer-connection-id";
const DATABASES_KEY_PREFIX = "db-viewer-databases-";

export function getStoredConnectionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CONNECTION_KEY);
}

export function setStoredConnectionId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) sessionStorage.setItem(CONNECTION_KEY, id);
  else sessionStorage.removeItem(CONNECTION_KEY);
}

export function getStoredDatabases(connectionId: string): DatabaseInfo[] | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DATABASES_KEY_PREFIX + connectionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DatabaseInfo[];
  } catch {
    return null;
  }
}

export function setStoredDatabases(
  connectionId: string,
  databases: DatabaseInfo[]
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    DATABASES_KEY_PREFIX + connectionId,
    JSON.stringify(databases)
  );
}

export function clearStoredDatabases(connectionId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DATABASES_KEY_PREFIX + connectionId);
}

/** Best-effort disconnect when the tab/window is closing (uses fetch keepalive). */
export function disconnectSessionOnUnload(): void {
  if (typeof window === "undefined") return;
  const connectionId = getStoredConnectionId();
  if (!connectionId) return;

  sessionStorage.removeItem(CONNECTION_KEY);

  void fetch("api/connect", {
    method: "DELETE",
    headers: {
      "X-Connection-Id": connectionId,
      "Content-Type": "application/json",
    },
    keepalive: true,
  });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const connectionId = getStoredConnectionId();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (connectionId) headers.set("X-Connection-Id", connectionId);

  const res = await fetch(path, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
