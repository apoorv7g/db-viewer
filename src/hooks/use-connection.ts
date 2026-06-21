"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiFetch, setStoredConnectionId } from "@/lib/api-client";
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

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiFetch("api/connect", { method: "DELETE" }),
    onSuccess: () => {
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
  };
}
