"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CornerDownRight, Search, Table2, Eye, Loader2, Inbox, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  const [pickedSchema, setPickedSchema] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "table" | "view">("table");
  const { session } = useConnection();
  const viewScope = `${session?.host ?? ""}:${session?.database ?? ""}`;
  const viewsByTable = useViewsByTable(viewScope);

  const { data, isLoading } = useQuery<{ tables: TableInfo[] }>({
    // Fetch the full list once and filter locally, so typing in the search
    // box is instant instead of a server round trip per keystroke.
    queryKey: ["tables"],
    queryFn: () => apiFetch<{ tables: TableInfo[] }>("api/tables"),
    staleTime: 60_000,
  });

  // Schemas present in this database, "public" first. Only the chosen
  // schema's tables are listed (defaults to public) so other schemas'
  // tables/views don't clutter the sidebar.
  const schemas = useMemo(() => {
    const names: string[] = Array.from(
      new Set((data?.tables ?? []).map((t: TableInfo) => t.schema))
    );
    return names.sort((a: string, b: string) =>
      a === "public" ? -1 : b === "public" ? 1 : a.localeCompare(b)
    );
  }, [data]);
  const activeSchema =
    pickedSchema && schemas.includes(pickedSchema)
      ? pickedSchema
      : (schemas[0] ?? "public");

  const kindCounts = useMemo(() => {
    const inSchema = (data?.tables ?? []).filter(
      (t: TableInfo) => t.schema === activeSchema
    );
    return {
      all: inSchema.length,
      table: inSchema.filter((t: TableInfo) => t.type === "table").length,
      view: inSchema.filter((t: TableInfo) => t.type === "view").length,
    };
  }, [data, activeSchema]);

  const tables = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = (data?.tables ?? []).filter(
      (t: TableInfo) =>
        t.schema === activeSchema &&
        (kind === "all" || t.type === kind) &&
        (!needle || t.name.toLowerCase().includes(needle))
    );
    return [...list].sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
      return a.schema.localeCompare(b.schema);
    });
  }, [data, search, activeSchema, kind]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 px-2 pb-1 pt-1">
        <div className="studio-section-label px-0! flex items-center justify-between">
          <span>Tables</span>
          <span className="tabular-nums normal-case tracking-normal">{tables.length}</span>
        </div>
        {schemas.length > 1 && (
          <Select
            value={activeSchema}
            onChange={(e) => setPickedSchema(e.target.value)}
            className="text-xs"
            aria-label="Schema"
          >
            {schemas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tables"
            className="h-8 pl-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div
          role="tablist"
          aria-label="Filter by type"
          className="flex rounded-md border border-border p-0.5"
        >
          {(
            [
              { id: "all", label: "All" },
              { id: "table", label: "Tables" },
              { id: "view", label: "Views" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={kind === opt.id}
              onClick={() => setKind(opt.id)}
              className={cn(
                "flex h-6 flex-1 items-center justify-center gap-1 rounded text-xs font-medium transition-colors",
                kind === opt.id
                  ? "bg-surface-hover text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
              <span className="tabular-nums text-[10px] text-muted">
                {kindCounts[opt.id]}
              </span>
            </button>
          ))}
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
                  <ul className="ml-3.75 mt-px space-y-px border-l border-border pl-1.5">
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
