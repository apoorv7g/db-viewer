"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  apiFetch,
  getStoredDatabases,
  setStoredDatabases,
} from "@/lib/api-client";
import type { DatabaseInfo } from "@/types/database";

export function useDatabases() {
  const listMutation = useMutation({
    mutationFn: (uri: string) =>
      apiFetch<{ databases: DatabaseInfo[] }>("api/databases", {
        method: "POST",
        body: JSON.stringify({ uri }),
      }),
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    databases: listMutation.data?.databases,
    listDatabases: listMutation.mutateAsync,
    isListing: listMutation.isPending,
    reset: listMutation.reset,
  };
}

/**
 * Lists the databases visible on the server behind the *current* connection.
 * Backed by sessionStorage (keyed by connection id) so the list survives
 * database switches and page reloads without refetching every table page.
 */
export function useConnectionDatabases(enabled: boolean, connectionId?: string) {
  const cached = connectionId ? getStoredDatabases(connectionId) : null;

  const query = useQuery({
    queryKey: ["databases", "current", connectionId],
    queryFn: () => apiFetch<{ databases: DatabaseInfo[] }>("api/databases"),
    enabled: enabled && !!connectionId,
    staleTime: Infinity,
    initialData: cached ? { databases: cached } : undefined,
  });

  useEffect(() => {
    if (connectionId && query.data?.databases) {
      setStoredDatabases(connectionId, query.data.databases);
    }
  }, [connectionId, query.data]);

  return {
    databases: query.data?.databases,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
