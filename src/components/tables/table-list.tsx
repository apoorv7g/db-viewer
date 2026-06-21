"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Table2, Eye, Loader2, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import type { TableInfo } from "@/types/database";
import { cn } from "@/lib/utils";

interface TableListProps {
  selected?: { schema: string; name: string } | null;
  onSelect: (table: { schema: string; name: string }) => void;
}

export function TableList({ selected, onSelect }: TableListProps) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["tables", search],
    queryFn: () =>
      apiFetch<{ tables: TableInfo[] }>(
        `api/tables${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
  });

  const tables = useMemo(() => {
    const list = data?.tables ?? [];
    return [...list].sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
      return a.schema.localeCompare(b.schema);
    });
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tables"
            className="h-8 border-border bg-surface pl-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Loading
          </div>
        )}

        {!isLoading && tables.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Inbox className="h-7 w-7 opacity-40" />
            <p className="text-xs">No tables found</p>
          </div>
        )}

        <ul className="space-y-0.5">
          {tables.map((table) => {
            const isSelected =
              selected?.schema === table.schema &&
              selected?.name === table.name;
            const Icon = table.type === "view" ? Eye : Table2;
            return (
              <li key={`${table.schema}.${table.name}`}>
                <button
                  type="button"
                  data-active={isSelected}
                  onClick={() =>
                    onSelect({ schema: table.schema, name: table.name })
                  }
                  className={cn("studio-sidebar-item w-full text-left")}
                >
                  <Icon className="sidebar-item-icon h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {table.name}
                  </span>
                  {table.rowCount !== undefined && (
                    <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                      {table.rowCount >= 1000
                        ? `${(table.rowCount / 1000).toFixed(1)}k`
                        : table.rowCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
