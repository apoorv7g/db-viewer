"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Database, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useConnection } from "@/hooks/use-connection";
import { useConnectionDatabases } from "@/hooks/use-databases";

export function DatabaseSwitcher() {
  const { session, switchDatabase, isSwitchingDatabase } = useConnection();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { databases, isLoading } = useConnectionDatabases(open);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!session) return null;

  const handleSelect = async (name: string) => {
    setOpen(false);
    if (name === session.database) return;
    await switchDatabase(name);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 font-medium text-foreground transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60"
        onClick={() => setOpen((o) => !o)}
        disabled={isSwitchingDatabase}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isSwitchingDatabase ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <span className="truncate">{session.database}</span>
        )}
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-xl shadow-black/10 dark:shadow-black/30">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Switch database
          </p>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading databases…
            </div>
          ) : databases && databases.length > 0 ? (
            databases.map((db) => {
              const isCurrent = db.name === session.database;
              return (
                <button
                  key={db.name}
                  type="button"
                  onClick={() => handleSelect(db.name)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover",
                    isCurrent && "bg-primary-muted"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono">{db.name}</span>
                  </span>
                  {isCurrent ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(db.sizeBytes)}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No accessible databases found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
