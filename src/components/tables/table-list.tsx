"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Table2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
        `/api/tables${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
  });

  const tables = useMemo(() => data?.tables ?? [], [data]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search tables…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && (
          <p className="text-sm text-zinc-500 p-2">Loading tables…</p>
        )}
        {!isLoading && tables.length === 0 && (
          <p className="text-sm text-zinc-500 p-2">No tables found</p>
        )}
        {tables.map((table) => {
          const isSelected =
            selected?.schema === table.schema && selected?.name === table.name;
          return (
            <button
              key={`${table.schema}.${table.name}`}
              type="button"
              onClick={() => onSelect({ schema: table.schema, name: table.name })}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
                isSelected && "bg-zinc-100 dark:bg-zinc-800"
              )}
            >
              {table.type === "view" ? (
                <Eye className="h-4 w-4 shrink-0 text-zinc-400" />
              ) : (
                <Table2 className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{table.name}</p>
                <p className="truncate text-xs text-zinc-500">{table.schema}</p>
              </div>
              {table.rowCount !== undefined && (
                <Badge variant="secondary">{table.rowCount.toLocaleString()}</Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
