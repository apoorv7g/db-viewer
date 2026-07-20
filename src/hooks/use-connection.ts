"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  apiFetch,
  clearStoredDatabases,
  getStoredConnectionId,
  setStoredConnectionId,
} from "@/lib/api-client";
import type { ConnectionSession } from "@/types/database";

export function useConnection() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["connection"],
    queryFn: () =>
      apiFetch<{ connected: boolean; session?: ConnectionSession }>(
        "api/connect"
      ),
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: (input: {
      uri: string;
      readOnly?: boolean;
      queryTimeoutMs?: number;
      resultLimit?: number;
    }) =>
      apiFetch<{ session: ConnectionSession }>("api/connect", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      setStoredConnectionId(data.session.id);
      queryClient.setQueryData(["connection"], {
        connected: true,
        session: data.session,
      });
      toast.success(`Connected to ${data.session.database}@${data.session.host}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const switchDatabaseMutation = useMutation({
    mutationFn: (database: string) =>
      apiFetch<{ session: ConnectionSession }>("api/connect/switch", {
        method: "POST",
        body: JSON.stringify({ database }),
      }),
    onSuccess: (data) => {
      // Update the session first, and as its own synchronous cache write,
      // so the UI (which remounts on session identity) reacts immediately
      // instead of waiting on the broader cache clear below.
      queryClient.setQueryData(["connection"], {
        connected: true,
        session: data.session,
      });
      // The connection id stays the same, but every table/schema/row query
      // cached under it now points at data from the previous database —
      // drop everything else so the remounted UI starts from a clean slate.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "connection",
      });
      toast.success(`Switched to ${data.session.database}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiFetch("api/connect", { method: "DELETE" }),
    onSuccess: () => {
      const connectionId = getStoredConnectionId();
      if (connectionId) clearStoredDatabases(connectionId);
      setStoredConnectionId(null);
      queryClient.setQueryData(["connection"], { connected: false });
      queryClient.clear();
      toast.success("Disconnected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    connected: statusQuery.data?.connected ?? false,
    session: statusQuery.data?.session,
    isLoading: statusQuery.isLoading,
    connect: connectMutation.mutateAsync,
    disconnect: disconnectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    switchDatabase: switchDatabaseMutation.mutateAsync,
    isSwitchingDatabase: switchDatabaseMutation.isPending,
  };
}
