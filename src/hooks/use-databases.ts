"use client";

import { useMutation } from "@tanstack/react-query";
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
