"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiFetch } from "@/lib/api-client";
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

/** Lists the databases visible on the server behind the *current* connection. */
export function useConnectionDatabases(enabled: boolean) {
  const query = useQuery({
    queryKey: ["databases", "current"],
    queryFn: () => apiFetch<{ databases: DatabaseInfo[] }>("api/databases"),
    enabled,
    staleTime: 30000,
  });

  return {
    databases: query.data?.databases,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
