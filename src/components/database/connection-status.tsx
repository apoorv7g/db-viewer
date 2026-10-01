"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatabaseSwitcher } from "@/components/database/database-switcher";
import { useConnection } from "@/hooks/use-connection";
import { LogOut, Circle } from "lucide-react";

interface ConnectionStatusProps {
  compact?: boolean;
}

export function ConnectionStatus({ compact }: ConnectionStatusProps) {
  const { session, disconnect, connected } = useConnection();

  if (!connected || !session) return null;

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <span className="truncate" title={session.host}>{session.host}</span>
          <span className="shrink-0 select-none text-lg font-light text-border" aria-hidden>/</span>
          <DatabaseSwitcher />
          <Circle className="ml-1 h-1.5 w-1.5 shrink-0 fill-primary-fill text-primary-fill" aria-label="Connected" />
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-muted-foreground"
          onClick={() => disconnect()}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Disconnect</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-sidebar px-4 py-2">
      <Circle className="h-2 w-2 fill-primary-fill text-primary-fill" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={session.database}>
          {session.database}
          <span className="font-normal text-muted-foreground">
            {" "}
            @ {session.host}
          </span>
        </p>
      </div>
      <Badge variant="success">Connected</Badge>
      <Button variant="ghost" size="sm" onClick={() => disconnect()}>
        <LogOut className="h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}
