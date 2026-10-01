"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CornerDownRight, Search, Table2, Eye, Loader2, Inbox, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import type { TableInfo } from "@/types/database";
import { cn } from "@/lib/utils";
import { useConnection } from "@/hooks/use-connection";
import { deleteView, tableKey, useViewsByTable } from "@/lib/view-store";

interface TableListProps {
  selected?: { schema: string; name: string; viewId?: string | null } | null;
  onSelect: (
    table: { schema: string; name: string },
    viewId?: string | null
  ) => void;
}

export function TableList({ selected, onSelect }: TableListProps) {
  const [search, setSearch] = useState("");
  const { session } = useConnection();
  const viewScope = `${session?.host ?? ""}:${session?.database ?? ""}`;
  const viewsByTable = useViewsByTable(viewScope);

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
      <div className="shrink-0 space-y-2 px-2 pb-1 pt-1">
        <div className="studio-section-label !px-0 flex items-center justify-between">
          <span>Tables</span>
          <span className="tabular-nums normal-case tracking-normal">{tables.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tables"
            className="h-8 pl-8 text-xs"
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

        <ul className="space-y-px">
          {tables.map((table) => {
            const isSelected =
              selected?.schema === table.schema &&
              selected?.name === table.name;
            const Icon = table.type === "view" ? Eye : Table2;
            const key = tableKey(table.schema, table.name);
            const views = viewsByTable[key] ?? [];
            return (
              <li key={`${table.schema}.${table.name}`}>
                <button
                  type="button"
                  data-active={isSelected && !selected?.viewId}
                  onClick={() =>
                    onSelect({ schema: table.schema, name: table.name })
                  }
                  className={cn("studio-sidebar-item w-full text-left")}
                >
                  <Icon className="sidebar-item-icon h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
                {views.length > 0 && (
                  <ul className="ml-[15px] mt-px space-y-px border-l border-border pl-1.5">
                    {views.map((view) => {
                      const viewActive = isSelected && selected?.viewId === view.id;
                      return (
                        <li key={view.id} className="group relative">
                          <button
                            type="button"
                            data-active={viewActive}
                            onClick={() =>
                              onSelect(
                                { schema: table.schema, name: table.name },
                                view.id
                              )
                            }
                            title={view.name}
                            className="studio-sidebar-item w-full pr-7 text-left"
                          >
                            <CornerDownRight className="sidebar-item-icon h-3 w-3 shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {view.name}
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete view ${view.name}`}
                            title="Delete view"
                            onClick={() => {
                              deleteView(viewScope, key, view.id);
                              if (viewActive) {
                                onSelect({ schema: table.schema, name: table.name }, null);
                              }
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
