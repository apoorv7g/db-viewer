"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/hooks/use-connection";
import { Database, LogOut, Shield } from "lucide-react";

export function ConnectionStatus() {
  const { session, disconnect, connected } = useConnection();

  if (!connected || !session) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      <Database className="h-4 w-4 text-emerald-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {session.database}@{session.host}
        </p>
      </div>
      {session.readOnly && (
        <Badge variant="warning" className="gap-1">
          <Shield className="h-3 w-3" />
          Read-only
        </Badge>
      )}
      <Badge variant="success">Connected</Badge>
      <Button variant="ghost" size="sm" onClick={() => disconnect()}>
        <LogOut className="h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}
