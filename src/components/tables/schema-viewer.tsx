"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ColumnInfo, TableSchema } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  Loader2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";

interface SchemaViewerProps {
  tableName: string;
  schema: string;
}

export function SchemaViewer({ tableName, schema }: SchemaViewerProps) {
  const { data, isLoading } = useQuery<{
    schema: TableSchema;
    softDeleteColumn: string | null;
  }>({
    queryKey: ["schema", schema, tableName],
    queryFn: () =>
      apiFetch<{ schema: TableSchema; softDeleteColumn: string | null }>(
        `api/tables/${encodeURIComponent(tableName)}/schema?schema=${encodeURIComponent(schema)}`
      ),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading schema…
      </div>
    );
  }

  const tableSchema = data?.schema;
  if (!tableSchema) return null;

  return (
    <div className="studio-panel overflow-hidden">
      {data?.softDeleteColumn && (
        <div className="flex items-center gap-2 border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Soft delete column:{" "}
          <code className="font-mono">{data.softDeleteColumn}</code>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="studio-table w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3">Column</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Nullable</th>
              <th className="px-4 py-3">Default</th>
            </tr>
          </thead>
          <tbody>
            {tableSchema.columns.map((col: ColumnInfo) => (
              <tr
                key={col.name}
                className="border-b border-border-subtle"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-zinc-200">
                    {col.name}
                  </span>
                  {col.isPrimaryKey && (
                    <Badge variant="default" className="ml-2 gap-0.5">
                      <KeyRound className="h-3 w-3" />
                      PK
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-primary">
                    {col.udtName}
                  </code>
                </td>
                <td className="px-4 py-3">
                  {col.isNullable ? (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                      <Check className="h-3.5 w-3.5" />
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <X className="h-3.5 w-3.5" />
                      No
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500 max-w-xs truncate">
                  {col.columnDefault ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
