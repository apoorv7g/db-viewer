"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import { apiFetch } from "@/lib/api-client";
import { downloadFile, exportToCsv, formatCellValue } from "@/lib/utils";
import type { ColumnInfo, PaginatedData, TableSchema } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<{
    field: string;
    value: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([]);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: "update" | "delete" | "insert";
    payload: unknown;
    message: string;
  } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const schemaQuery = useQuery<{ schema: TableSchema }>({
    queryKey: ["schema", schema, tableName],
    queryFn: () =>
      apiFetch<{ schema: TableSchema }>(
        `/api/tables/${encodeURIComponent(tableName)}/schema?schema=${encodeURIComponent(schema)}`
      ),
  });

  const dataQuery = useQuery<PaginatedData>({
    queryKey: [
      "data",
      schema,
      tableName,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      appliedFilter?.field,
      appliedFilter?.value,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        schema,
        page: String(page),
        pageSize: String(pageSize),
        sortDirection,
      });
      if (sortColumn) params.set("sortColumn", sortColumn);
      if (appliedFilter?.field && appliedFilter.value) {
        params.set("filterColumn", appliedFilter.field);
        params.set("filterValue", appliedFilter.value);
      }
      return apiFetch<PaginatedData>(
        `/api/tables/${encodeURIComponent(tableName)}/data?${params}`
      );
    },
  });

  const tableSchema = schemaQuery.data?.schema;
  const primaryKeys: string[] = tableSchema?.primaryKeys ?? [];
  const rows: Record<string, unknown>[] = dataQuery.data?.rows ?? [];
  const allSelected =
    rows.length > 0 &&
    rows.every((row) =>
      selectedRows.some((r) =>
        primaryKeys.every((k) => r[k] === row[k])
      )
    );
  const someSelected = selectedRows.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: string[] = dataQuery.data?.columns ?? [];
    return [
      {
        id: "select",
        header: () => (
          <Checkbox
            ref={selectAllRef}
            checked={allSelected}
            onChange={(e) => {
              if (e.target.checked) setSelectedRows(rows);
              else setSelectedRows([]);
            }}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => {
          const isSelected = selectedRows.some((r) =>
            primaryKeys.every((k) => r[k] === row.original[k])
          );
          return (
            <Checkbox
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
              aria-label="Select row"
            />
          );
        },
        size: 44,
      },
      ...cols.map((col) => ({
        id: col,
        accessorKey: col,
        header: () => (
          <button
            type="button"
            className="flex items-center gap-1 font-medium text-foreground/80 hover:text-primary"
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
            {sortColumn === col ? (
              sortDirection === "asc" ? (
                <ArrowUp className="h-3 w-3 text-primary" />
              ) : (
                <ArrowDown className="h-3 w-3 text-primary" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        ),
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue();
          const display = formatCellValue(v);
          return (
            <span
              className={`block max-w-[200px] truncate ${v === null ? "italic text-muted-foreground" : "text-foreground/90"}`}
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
  }, [
    dataQuery.data,
    sortColumn,
    sortDirection,
    selectedRows,
    readOnly,
    primaryKeys,
    allSelected,
    rows,
  ]);

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
      toast.error("Table has no primary key. Cannot update safely.");
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
      toast.error("Table has no primary key. Cannot delete safely.");
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

  const applyFilter = () => {
    const value = filterValue.trim();
    if (!filterField || !value) {
      toast.error("Choose a field and enter a value to filter");
      return;
    }
    setAppliedFilter({ field: filterField, value });
    setPage(1);
  };

  const clearFilter = () => {
    setFilterField("");
    setFilterValue("");
    setAppliedFilter(null);
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <button
            type="button"
            className="studio-toolbar-btn"
            data-active={filtersOpen || !!appliedFilter}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {appliedFilter ? (
              <span className="max-w-32 truncate text-primary">
                ({appliedFilter.field} = {appliedFilter.value})
              </span>
            ) : null}
          </button>

          {!readOnly && (
            <Button size="sm" onClick={() => setInsertOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add record
            </Button>
          )}

          {!readOnly && selectedRows.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedRows.length})
            </Button>
          )}

          <div className="flex-1" />

          <span className="text-xs tabular-nums text-muted-foreground">
            {total.toLocaleString()} records
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 w-16 px-1 text-xs"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
              {page} / {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refresh()}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={exportCsv}
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
            <Select
              value={filterField}
              onChange={(e) => setFilterField(e.target.value)}
              className="h-8 w-44 text-xs"
              aria-label="Filter field"
            >
              <option value="" disabled>
                Select field
              </option>
              {(tableSchema?.columns ?? []).map((c: ColumnInfo) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Value"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="h-8 w-48 text-xs"
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            />
            <Button variant="secondary" size="sm" onClick={applyFilter}>
              Apply
            </Button>
            {appliedFilter ? (
              <Button variant="ghost" size="sm" onClick={clearFilter}>
                Clear
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="studio-table">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={
                      header.id === "select"
                        ? "w-11 whitespace-nowrap"
                        : "whitespace-nowrap"
                    }
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
                <td colSpan={columns.length} className="p-12 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-zinc-500">
                  No rows
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border-subtle"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cell.column.id === "select" ? "w-11" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
