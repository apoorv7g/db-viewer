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
  Copy,
  Download,
  Expand,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import { apiFetch } from "@/lib/api-client";
import {
  downloadFile,
  exportToCsv,
  formatCellValue,
  formatExpandedCellValue,
} from "@/lib/utils";
import type { ColumnInfo, PaginatedData, TableSchema } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationModal } from "@/components/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowForm } from "@/components/forms/row-form";
import { JsonEditor } from "@/components/forms/json-editor";
import { useConnection } from "@/hooks/use-connection";

const PAGE_SIZES = [10, 50, 100, 500] as const;

function getRowKey(
  row: Record<string, unknown>,
  primaryKeys: string[],
  columns: string[]
) {
  const keys = primaryKeys.length > 0 ? primaryKeys : columns;
  return keys.map((k) => String(row[k] ?? "")).join("\0");
}

type PendingRowEdit = {
  row: Record<string, unknown>;
  changes: Record<string, string>;
};

type CellDialogState = {
  row: Record<string, unknown>;
  rowKey: string;
  columnId: string;
  value: unknown;
  cols: string[];
  editable: boolean;
};

function cellEditValue(value: unknown, column?: ColumnInfo): string {
  if (value === null || value === undefined) return "";
  const udt = column?.udtName.toLowerCase();
  if (udt === "json" || udt === "jsonb") {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  }
  return formatCellValue(value) === "NULL" ? "" : formatCellValue(value);
}

interface DataGridProps {
  tableName: string;
  schema: string;
}

export function DataGrid({ tableName, schema }: DataGridProps) {
  const queryClient = useQueryClient();
  const { session } = useConnection();
  const readOnly = session?.readOnly ?? false;

  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
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
  const [pendingEdits, setPendingEdits] = useState<Record<string, PendingRowEdit>>({});
  const [savingEdits, setSavingEdits] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [cellDialog, setCellDialog] = useState<CellDialogState | null>(null);
  const [cellDialogValue, setCellDialogValue] = useState("");
  const [confirm, setConfirm] = useState<{
    type: "update" | "batch-update" | "delete" | "insert";
    payload: unknown;
    message: string;
  } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const pendingChangeCount = useMemo(
    () =>
      Object.values(pendingEdits).reduce(
        (count, edit) => count + Object.keys(edit.changes).length,
        0
      ),
    [pendingEdits]
  );

  const schemaQuery = useQuery<{ schema: TableSchema }>({
    queryKey: ["schema", schema, tableName],
    queryFn: () =>
      apiFetch<{ schema: TableSchema }>(
        `api/tables/${encodeURIComponent(tableName)}/schema?schema=${encodeURIComponent(schema)}`
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
        `api/tables/${encodeURIComponent(tableName)}/data?${params}`
      );
    },
  });

  const tableSchema = schemaQuery.data?.schema;
  const primaryKeys = useMemo<string[]>(
    () => tableSchema?.primaryKeys ?? [],
    [tableSchema]
  );
  const rows = useMemo<Record<string, unknown>[]>(
    () => dataQuery.data?.rows ?? [],
    [dataQuery.data?.rows]
  );
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

  const getColumnMeta = useCallback(
    (columnId: string) => tableSchema?.columns.find((c: ColumnInfo) => c.name === columnId),
    [tableSchema]
  );

  const parseValueForColumn = useCallback(
    (columnId: string, raw: string): unknown => {
      const col = getColumnMeta(columnId);
      if (!col) return raw;

      const trimmed = raw.trim();
      if (trimmed === "") {
        return col.isNullable ? null : "";
      }

      const udt = col.udtName.toLowerCase();
      if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(udt)) {
        const n = Number(trimmed);
        return Number.isNaN(n) ? raw : n;
      }
      if (udt === "bool") {
        if (trimmed === "true") return true;
        if (trimmed === "false") return false;
        return raw;
      }
      if (udt === "json" || udt === "jsonb") {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    },
    [getColumnMeta]
  );

  const buildWhere = useCallback(
    (row: Record<string, unknown>) => {
      const where: Record<string, unknown> = {};
      if (primaryKeys.length > 0) {
        for (const pk of primaryKeys) where[pk] = row[pk];
      } else if (tableSchema) {
        for (const col of tableSchema.columns) {
          if (row[col.name] !== undefined) {
            where[col.name] = row[col.name];
          }
        }
      }
      return where;
    },
    [primaryKeys, tableSchema]
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["data", schema, tableName] });
  }, [queryClient, schema, tableName]);

  const handleUpdate = useCallback(
    async (
      values: Record<string, unknown>,
      confirmed = false,
      targetRow?: Record<string, unknown>,
      fromRowDialog = false
    ) => {
      const row = targetRow ?? editRow;
      if (!row) {
        toast.error("No row selected for update.");
        return;
      }
      const res = await apiFetch<{
        requiresConfirmation?: boolean;
        updated?: number;
        message?: string;
        preview?: unknown;
      }>(`api/tables/${encodeURIComponent(tableName)}/data`, {
        method: "PUT",
        body: JSON.stringify({
          data: values,
          where: buildWhere(row),
          schema,
          confirmed,
        }),
      });
      if (res.requiresConfirmation) {
        if (fromRowDialog) setEditRow(row);
        setConfirm({
          type: "update",
          payload: { values, targetRow: row },
          message: res.message ?? "Confirm update?",
        });
        return;
      }
      toast.success(`Updated ${res.updated} row(s)`);
      setEditRow(null);
      refresh();
    },
    [editRow, tableName, buildWhere, schema, refresh]
  );

  const updatePendingCell = useCallback(
    (
      row: Record<string, unknown>,
      columnId: string,
      rawValue: string,
      cols: string[]
    ) => {
      const rowKey = getRowKey(row, primaryKeys, cols);
      const original = cellEditValue(row[columnId], getColumnMeta(columnId));

      setPendingEdits((prev) => {
        const next = { ...prev };
        const existing = next[rowKey] ?? { row, changes: {} };

        if (rawValue === original) {
          const rest = { ...existing.changes };
          delete rest[columnId];
          if (Object.keys(rest).length === 0) {
            delete next[rowKey];
          } else {
            next[rowKey] = { row, changes: rest };
          }
        } else {
          next[rowKey] = {
            row,
            changes: { ...existing.changes, [columnId]: rawValue },
          };
        }
        return next;
      });
    },
    [getColumnMeta, primaryKeys]
  );

  const revertPendingCell = useCallback(
    (row: Record<string, unknown>, columnId: string, cols: string[]) => {
      const rowKey = getRowKey(row, primaryKeys, cols);
      setPendingEdits((prev) => {
        const existing = prev[rowKey];
        if (!existing) return prev;

        const next = { ...prev };
        const rest = { ...existing.changes };
        delete rest[columnId];
        if (Object.keys(rest).length === 0) {
          delete next[rowKey];
        } else {
          next[rowKey] = { ...existing, changes: rest };
        }
        return next;
      });
    },
    [primaryKeys]
  );

  const cancelAllPendingEdits = useCallback(() => {
    setPendingEdits({});
  }, []);

  const savePendingEdits = useCallback(
    async (confirmed = false) => {
      const edits = Object.values(pendingEdits);
      if (edits.length === 0) return;

      if (!confirmed) {
        const preview = edits.map((edit) => ({
          where: buildWhere(edit.row),
          data: Object.fromEntries(
            Object.entries(edit.changes).map(([col, raw]) => [
              col,
              parseValueForColumn(col, raw),
            ])
          ),
        }));
        setConfirm({
          type: "batch-update",
          payload: { preview },
          message: `Save ${pendingChangeCount} cell change(s) across ${edits.length} row(s)?`,
        });
        return;
      }

      setSavingEdits(true);
      try {
        let updated = 0;
        for (const edit of edits) {
          const data = Object.fromEntries(
            Object.entries(edit.changes).map(([col, raw]) => [
              col,
              parseValueForColumn(col, raw),
            ])
          );
          const res = await apiFetch<{ updated?: number; error?: string }>(
            `api/tables/${encodeURIComponent(tableName)}/data`,
            {
              method: "PUT",
              body: JSON.stringify({
                data,
                where: buildWhere(edit.row),
                schema,
                confirmed: true,
              }),
            }
          );
          if (res.error) throw new Error(res.error);
          updated += res.updated ?? 0;
        }
        toast.success(`Updated ${updated} row(s)`);
        setPendingEdits({});
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      } finally {
        setSavingEdits(false);
      }
    },
    [
      pendingEdits,
      pendingChangeCount,
      buildWhere,
      parseValueForColumn,
      tableName,
      schema,
      refresh,
    ]
  );

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
        cell: ({ row, getValue }: { row: { original: Record<string, unknown> }; getValue: () => unknown }) => {
          const v = getValue();
          const isPk = primaryKeys.includes(col);
          const columnMeta = getColumnMeta(col);
          const rowKey = getRowKey(row.original, primaryKeys, cols);
          const isModified = pendingEdits[rowKey]?.changes[col] !== undefined;
          const editValue =
            pendingEdits[rowKey]?.changes[col] ??
            cellEditValue(v, columnMeta);
          const display = isModified
            ? editValue || "NULL"
            : formatCellValue(v);
          const expanded = formatExpandedCellValue(v);
          const canPreview =
            expanded.mode === "json" ||
            expanded.text.includes("\n") ||
            expanded.text.length > 120;

          return (
            <div className="group flex max-w-[280px] items-start gap-1">
              <div
                role="button"
                tabIndex={0}
                className={`min-w-0 flex-1 truncate text-left ${
                  readOnly || isPk ? "cursor-default" : "cursor-text"
                } ${
                  isModified
                    ? "rounded bg-amber-500/10 px-1 ring-1 ring-inset ring-amber-500/40"
                    : ""
                } ${v === null && !isModified ? "italic text-muted-foreground" : "text-foreground/90"}`}
                title={display}
                onDoubleClick={() => {
                  setCellDialog({
                    row: row.original,
                    rowKey,
                    columnId: col,
                    value: v,
                    cols,
                    editable: !readOnly && !isPk,
                  });
                  setCellDialogValue(editValue);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setCellDialog({
                      row: row.original,
                      rowKey,
                      columnId: col,
                      value: v,
                      cols,
                      editable: !readOnly && !isPk,
                    });
                    setCellDialogValue(editValue);
                  }
                }}
              >
                {display}
              </div>
              {canPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCellDialog({
                      row: row.original,
                      rowKey,
                      columnId: col,
                      value: v,
                      cols,
                      editable: !readOnly && !isPk,
                    });
                    setCellDialogValue(editValue);
                  }}
                  title={`Open ${col} value`}
                  aria-label={`Open ${col} value`}
                >
                  <Expand className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
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
    pendingEdits,
    getColumnMeta,
  ]);

  const table = useReactTable({
    data: dataQuery.data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleInsert = async (
    values: Record<string, unknown>,
    confirmed = false
  ) => {
    const res = await apiFetch<{
      requiresConfirmation?: boolean;
      inserted?: number;
      message?: string;
    }>(`api/tables/${encodeURIComponent(tableName)}/data`, {
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
    }>(`api/tables/${encodeURIComponent(tableName)}/data`, {
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
    if (confirm.type === "update") {
      const { values, targetRow } = confirm.payload as {
        values: Record<string, unknown>;
        targetRow: Record<string, unknown>;
      };
      await handleUpdate(values, true, targetRow);
    } else if (confirm.type === "batch-update") {
      await savePendingEdits(true);
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    cancelAllPendingEdits();
  }, [
    page,
    pageSize,
    sortColumn,
    sortDirection,
    appliedFilter,
    tableName,
    schema,
    cancelAllPendingEdits,
  ]);

  const jumpToPage = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.min(Math.max(1, parsed), totalPages);
    setPage(nextPage);
    setPageInput(String(nextPage));
  };

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
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && jumpToPage()}
              onBlur={jumpToPage}
              className="h-7 w-12 px-1 text-center text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Page number"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              / {totalPages}
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

      {pendingChangeCount > 0 && !readOnly && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5">
          <span className="text-sm text-muted-foreground">
            {pendingChangeCount} unsaved change{pendingChangeCount === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelAllPendingEdits}
              disabled={savingEdits}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => void savePendingEdits()}
              disabled={savingEdits}
            >
              <ArrowUp className="h-4 w-4" />
              {savingEdits ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

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
              onSubmit={(v) => handleUpdate(v, false, editRow, true)}
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

      <Dialog open={!!cellDialog} onOpenChange={(open) => !open && setCellDialog(null)}>
        <DialogContent
          onClose={() => setCellDialog(null)}
          className="mx-4 max-h-[88vh] w-[min(92vw,1100px)] max-w-5xl overflow-hidden p-0"
        >
          {cellDialog && (
            <CellEditorDialog
              columnId={cellDialog.columnId}
              column={getColumnMeta(cellDialog.columnId)}
              value={cellDialog.value}
              draftValue={cellDialogValue}
              editable={cellDialog.editable}
              onChange={setCellDialogValue}
              onRevert={() => {
                revertPendingCell(cellDialog.row, cellDialog.columnId, cellDialog.cols);
                setCellDialogValue(
                  cellEditValue(
                    cellDialog.row[cellDialog.columnId],
                    getColumnMeta(cellDialog.columnId)
                  )
                );
              }}
              onSave={() => {
                updatePendingCell(
                  cellDialog.row,
                  cellDialog.columnId,
                  cellDialogValue,
                  cellDialog.cols
                );
                setCellDialog(null);
              }}
              onClose={() => setCellDialog(null)}
              hasPendingChange={
                pendingEdits[cellDialog.rowKey]?.changes[cellDialog.columnId] !==
                undefined
              }
            />
          )}
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

function CellEditorDialog({
  columnId,
  column,
  value,
  draftValue,
  editable,
  hasPendingChange,
  onChange,
  onSave,
  onRevert,
  onClose,
}: {
  columnId: string;
  column?: ColumnInfo;
  value: unknown;
  draftValue: string;
  editable: boolean;
  hasPendingChange: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onRevert: () => void;
  onClose: () => void;
}) {
  const expanded = formatExpandedCellValue(value);
  const lineCount = expanded.text.split("\n").length;
  const charCount = expanded.text.length;
  const udt = column?.udtName.toLowerCase();
  const isJson = udt === "json" || udt === "jsonb";
  const isBool = udt === "bool";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editable ? draftValue : expanded.text);
      toast.success("Copied value");
    } catch {
      toast.error("Failed to copy value");
    }
  };

  return (
    <div className="flex max-h-[88vh] flex-col">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-4 pr-10">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{columnId}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {editable
                ? "Edit value"
                : expanded.mode === "json"
                  ? "Formatted JSON"
                  : "Expanded value"}{" "}
              · {lineCount.toLocaleString()} line{lineCount === 1 ? "" : "s"} ·{" "}
              {charCount.toLocaleString()} chars
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {editable ? (
          isJson ? (
            <JsonEditor value={draftValue} onChange={onChange} />
          ) : isBool ? (
            <Select
              value={draftValue === "" ? "false" : draftValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-40"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </Select>
          ) : (
            <Textarea
              autoFocus
              value={draftValue}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[55vh] font-mono text-xs leading-6"
            />
          )
        ) : (
          <pre className="min-h-full overflow-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-6 whitespace-pre-wrap wrap-break-word text-foreground">
            {expanded.text}
          </pre>
        )}
      </div>
      <DialogFooter className="border-t border-border px-5 py-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {editable ? (
          <>
            {hasPendingChange ? (
              <Button variant="ghost" onClick={onRevert}>
                Revert
              </Button>
            ) : null}
            <Button onClick={onSave}>Apply</Button>
          </>
        ) : null}
      </DialogFooter>
    </div>
  );
}
