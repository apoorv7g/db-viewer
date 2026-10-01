"use client";

import { Copy, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  OPERATORS,
  OPERATOR_LABELS,
  operatorNeedsValue,
} from "@/lib/filters";
import type { FilterOperator, TableFilter } from "@/types/database";

interface FilterPanelProps {
  columns: string[];
  filters: TableFilter[];
  onChange: (filters: TableFilter[]) => void;
  onApply: () => void;
  onClear: () => void;
  dirty: boolean;
  /** Builds the SELECT equivalent to the filters currently in the panel. */
  buildSql: () => string;
}

export function FilterPanel({
  columns,
  filters,
  onChange,
  onApply,
  onClear,
  dirty,
  buildSql,
}: FilterPanelProps) {
  const patch = (index: number, change: Partial<TableFilter>) =>
    onChange(filters.map((f, i) => (i === index ? { ...f, ...change } : f)));

  const add = () =>
    onChange([
      ...filters,
      { field: columns[0] ?? "", op: "contains", value: "" },
    ]);

  return (
    <div className="space-y-2 border-t border-border px-4 py-3">
      {filters.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No filters. Add one to narrow down the rows.
        </p>
      )}

      {filters.map((filter, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-10 shrink-0 text-xs text-muted-foreground">
            {i === 0 ? "Where" : "And"}
          </span>
          <Select
            value={filter.field}
            onChange={(e) => patch(i, { field: e.target.value })}
            className="w-44 text-xs"
            aria-label="Filter field"
          >
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={filter.op}
            onChange={(e) => patch(i, { op: e.target.value as FilterOperator })}
            className="w-36 text-xs"
            aria-label="Filter operator"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </Select>
          {operatorNeedsValue(filter.op) && (
            <Input
              placeholder="Value"
              value={filter.value}
              onChange={(e) => patch(i, { value: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && onApply()}
              className="w-52 text-xs"
              aria-label="Filter value"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange(filters.filter((_, idx) => idx !== i))}
            aria-label="Remove filter"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add filter
        </Button>
        <Button size="sm" onClick={onApply} disabled={!dirty}>
          Apply
        </Button>
        {filters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(buildSql());
              toast.success("SQL copied");
            } catch {
              toast.error("Failed to copy SQL");
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy SQL
        </Button>
      </div>
    </div>
  );
}
