"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Database, Loader2, Search } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useConnection } from "@/hooks/use-connection";
import { useConnectionDatabases } from "@/hooks/use-databases";
import type { DatabaseInfo } from "@/types/database";

export function DatabaseSwitcher() {
  const { session, switchDatabase, isSwitchingDatabase } = useConnection();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { databases, isLoading } = useConnectionDatabases(open, session?.id);

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

  const needle = search.trim().toLowerCase();
  const filtered = databases?.filter(
    (db: DatabaseInfo) => !needle || db.name.toLowerCase().includes(needle)
  );

  const handleSelect = async (name: string) => {
    setOpen(false);
    if (name === session.database) return;
    await switchDatabase(name);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-[13px] font-medium text-foreground transition-colors hover:border-border hover:bg-surface disabled:pointer-events-none disabled:opacity-60"
        onClick={() => {
          setSearch("");
          setOpen((o) => !o);
        }}
        disabled={isSwitchingDatabase}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isSwitchingDatabase ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <span className="truncate" title={session.database}>
            {session.database}
          </span>
        )}
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-60 mt-1 max-h-64 w-max min-w-64 max-w-96 overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-2xl shadow-black/20 dark:shadow-black/60">
          <div className="relative px-0.5 pb-1.5 pt-0.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search databases"
              className="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary-fill focus:ring-2 focus:ring-primary-fill/25"
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading databases…
            </div>
          ) : filtered && filtered.length > 0 ? (
            filtered.map((db: DatabaseInfo) => {
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
                    <span className="truncate font-mono" title={db.name}>
                      {db.name}
                    </span>
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
              {needle ? "No databases match your search." : "No accessible databases found."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
