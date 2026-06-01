"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch } from "@/lib/api-client";
import { downloadFile, exportToCsv, formatCellValue } from "@/lib/utils";
import type { ColumnInfo, PaginatedData, TableSchema } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmationModal } from "@/components/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowForm } from "@/components/forms/row-form";
import { useConnection } from "@/hooks/use-connection";

const PAGE_SIZES = [10, 50, 100, 500] as const;

interface DataGridProps {
  tableName: string;
  schema: string;
}

export function DataGrid({ tableName, schema }: DataGridProps) {
  const queryClient = useQueryClient();
  const { session } = useConnection();
  const readOnly = session?.readOnly ?? false;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortColumn, setSortColumn] = useState<string | undefined>();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([]);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: "update" | "delete" | "insert";
    payload: unknown;
    message: string;
  } | null>(null);

  const schemaQuery = useQuery({
    queryKey: ["schema", schema, tableName],
    queryFn: () =>
      apiFetch<{ schema: TableSchema }>(
        `/api/tables/${encodeURIComponent(tableName)}/schema?schema=${encodeURIComponent(schema)}`
      ),
  });

  const dataQuery = useQuery({
    queryKey: [
      "data",
      schema,
      tableName,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filterColumn,
      filterValue,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        schema,
        page: String(page),
        pageSize: String(pageSize),
        sortDirection,
      });
      if (sortColumn) params.set("sortColumn", sortColumn);
      if (filterColumn && filterValue) {
        params.set("filterColumn", filterColumn);
        params.set("filterValue", filterValue);
      }
      return apiFetch<PaginatedData>(
        `/api/tables/${encodeURIComponent(tableName)}/data?${params}`
      );
    },
  });

  const tableSchema = schemaQuery.data?.schema;
  const primaryKeys = tableSchema?.primaryKeys ?? [];

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols = dataQuery.data?.columns ?? [];
    return [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            onChange={(e) => {
              if (e.target.checked) setSelectedRows(dataQuery.data?.rows ?? []);
              else setSelectedRows([]);
            }}
          />
        ),
        cell: ({ row }) => {
          const isSelected = selectedRows.some((r) =>
            primaryKeys.every((k) => r[k] === row.original[k])
          );
          return (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                if (e.target.checked)
                  setSelectedRows((prev) => [...prev, row.original]);
                else
                  setSelectedRows((prev) =>
                    prev.filter((r) =>
                      !primaryKeys.every((k) => r[k] === row.original[k])
                    )
                  );
              }}
            />
          );
        },
        size: 40,
      },
      ...cols.map((col) => ({
        id: col,
        accessorKey: col,
        header: () => (
          <button
            type="button"
            className="flex items-center gap-1 font-medium hover:text-zinc-900"
            onClick={() => {
              if (sortColumn === col) {
                setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
              } else {
                setSortColumn(col);
                setSortDirection("asc");
              }
              setPage(1);
            }}
          >
            {col}
            {sortColumn === col &&
              (sortDirection === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              ))}
          </button>
        ),
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue();
          const display = formatCellValue(v);
          return (
            <span
              className={`block max-w-xs truncate font-mono text-xs ${v === null ? "text-zinc-400 italic" : ""}`}
              title={display}
            >
              {display}
            </span>
          );
        },
      })),
      ...(!readOnly
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: Record<string, unknown> } }) => (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditRow(row.original)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ),
              size: 48,
            } as ColumnDef<Record<string, unknown>>,
          ]
        : []),
    ];
  }, [dataQuery.data, sortColumn, sortDirection, selectedRows, readOnly, primaryKeys]);

  const table = useReactTable({
    data: dataQuery.data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["data", schema, tableName] });
  }, [queryClient, schema, tableName]);

  const buildWhere = (row: Record<string, unknown>) => {
    const where: Record<string, unknown> = {};
    for (const pk of primaryKeys) where[pk] = row[pk];
    return where;
  };

  const handleUpdate = async (values: Record<string, unknown>, confirmed = false) => {
    if (!editRow || primaryKeys.length === 0) {
      toast.error("Table has no primary key  cannot update safely");
      return;
    }
    const res = await apiFetch<{
      requiresConfirmation?: boolean;
      updated?: number;
      message?: string;
      preview?: unknown;
    }>(`/api/tables/${encodeURIComponent(tableName)}/data`, {
      method: "PUT",
      body: JSON.stringify({
        data: values,
        where: buildWhere(editRow),
        schema,
        confirmed,
      }),
    });
    if (res.requiresConfirmation) {
      setConfirm({
        type: "update",
        payload: { values },
        message: res.message ?? "Confirm update?",
      });
      return;
    }
    toast.success(`Updated ${res.updated} row(s)`);
    setEditRow(null);
    refresh();
  };

  const handleInsert = async (
    values: Record<string, unknown>,
    confirmed = false
  ) => {
    const res = await apiFetch<{
      requiresConfirmation?: boolean;
      inserted?: number;
      message?: string;
    }>(`/api/tables/${encodeURIComponent(tableName)}/data`, {
      method: "POST",
      body: JSON.stringify({
        rows: [values],
        schema,
        confirmed,
      }),
    });
    if (res.requiresConfirmation) {
      setConfirm({
        type: "insert",
        payload: { values },
        message: res.message ?? "Confirm insert?",
      });
      return;
    }
    toast.success(`Inserted ${res.inserted} row(s)`);
    setInsertOpen(false);
    refresh();
  };

  const handleDelete = async (confirmed = false) => {
    if (selectedRows.length === 0) return;
    if (primaryKeys.length === 0) {
      toast.error("Table has no primary key  cannot delete safely");
      return;
    }
    const whereList = selectedRows.map(buildWhere);
    const res = await apiFetch<{
      requiresConfirmation?: boolean;
      deleted?: number;
      message?: string;
    }>(`/api/tables/${encodeURIComponent(tableName)}/data`, {
      method: "DELETE",
      body: JSON.stringify({ where: whereList, schema, confirmed }),
    });
    if (res.requiresConfirmation) {
      setConfirm({
        type: "delete",
        payload: { whereList },
        message: res.message ?? "Confirm delete?",
      });
      return;
    }
    toast.success(`Deleted ${res.deleted} row(s)`);
    setSelectedRows([]);
    refresh();
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === "update" && editRow) {
      const { values } = confirm.payload as { values: Record<string, unknown> };
      await handleUpdate(values, true);
    } else if (confirm.type === "insert") {
      const { values } = confirm.payload as { values: Record<string, unknown> };
      await handleInsert(values, true);
    } else if (confirm.type === "delete") {
      await handleDelete(true);
    }
    setConfirm(null);
  };

  const exportCsv = () => {
    const cols = dataQuery.data?.columns ?? [];
    const csv = exportToCsv(cols, dataQuery.data?.rows ?? []);
    downloadFile(csv, `${tableName}.csv`, "text/csv");
  };

  const total = dataQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
        <Badge variant="secondary">
          {total.toLocaleString()} rows
        </Badge>
        <div className="flex-1" />
        <Select
          value={filterColumn}
          onChange={(e) => setFilterColumn(e.target.value)}
          className="w-32"
        >
          <option value="">Filter col</option>
          {(tableSchema?.columns ?? []).map((c: ColumnInfo) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Filter value"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="w-40"
          onKeyDown={(e) => e.key === "Enter" && setPage(1)}
        />
        <Select
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="w-24"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" />
        </Button>
        {!readOnly && (
          <>
            <Button size="sm" onClick={() => setInsertOpen(true)}>
              <Plus className="h-4 w-4" />
              Insert
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedRows.length === 0}
              onClick={() => handleDelete()}
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedRows.length})
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-200 dark:border-zinc-800">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-3 py-2 font-medium whitespace-nowrap"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {dataQuery.isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-zinc-500">
                  No rows
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-3 border-t border-zinc-200 dark:border-zinc-800">
        <span className="text-sm text-zinc-500">
          Page {page} of {totalPages || 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent onClose={() => setEditRow(null)} className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit row</DialogTitle>
          </DialogHeader>
          {tableSchema && editRow && (
            <RowForm
              columns={tableSchema.columns}
              initialValues={editRow}
              primaryKeys={primaryKeys}
              onSubmit={(v) => handleUpdate(v)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="submit" form="row-form">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
        <DialogContent onClose={() => setInsertOpen(false)} className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Insert row</DialogTitle>
          </DialogHeader>
          {tableSchema && (
            <RowForm
              columns={tableSchema.columns}
              onSubmit={(v) => handleInsert(v)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="row-form">
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Confirm action"
        description={confirm?.message ?? ""}
        variant={confirm?.type === "delete" ? "destructive" : "default"}
        confirmLabel="Yes, proceed"
        onConfirm={handleConfirm}
        preview={confirm?.payload}
      />
    </div>
  );
}
