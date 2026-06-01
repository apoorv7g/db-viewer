"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { TableSchema } from "@/types/database";
import { Badge } from "@/components/ui/badge";

interface SchemaViewerProps {
  tableName: string;
  schema: string;
}

export function SchemaViewer({ tableName, schema }: SchemaViewerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["schema", schema, tableName],
    queryFn: () =>
      apiFetch<{ schema: TableSchema; softDeleteColumn: string | null }>(
        `/api/tables/${encodeURIComponent(tableName)}/schema?schema=${encodeURIComponent(schema)}`
      ),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Loading schema…</p>;

  const tableSchema = data?.schema;
  if (!tableSchema) return null;

  return (
    <div className="overflow-x-auto">
      {data?.softDeleteColumn && (
        <p className="text-xs text-amber-600 mb-2">
          Soft delete column detected: {data.softDeleteColumn}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="text-left py-2 px-2">Column</th>
            <th className="text-left py-2 px-2">Type</th>
            <th className="text-left py-2 px-2">Nullable</th>
            <th className="text-left py-2 px-2">Default</th>
          </tr>
        </thead>
        <tbody>
          {tableSchema.columns.map((col) => (
            <tr
              key={col.name}
              className="border-b border-zinc-100 dark:border-zinc-900"
            >
              <td className="py-2 px-2 font-mono">
                {col.name}
                {col.isPrimaryKey && (
                  <Badge variant="secondary" className="ml-2">
                    PK
                  </Badge>
                )}
              </td>
              <td className="py-2 px-2 text-zinc-500">{col.udtName}</td>
              <td className="py-2 px-2">{col.isNullable ? "Yes" : "No"}</td>
              <td className="py-2 px-2 text-zinc-500 font-mono text-xs">
                {col.columnDefault ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
