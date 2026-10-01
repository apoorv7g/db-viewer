import type { FilterOperator, TableFilter } from "@/types/database";

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "contains",
  not_contains: "doesn't contain",
  equals: "equals",
  not_equals: "not equals",
  starts_with: "starts with",
  ends_with: "ends with",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  is_null: "is null",
  is_not_null: "is not null",
};

export const OPERATORS = Object.keys(OPERATOR_LABELS) as FilterOperator[];

export function operatorNeedsValue(op: FilterOperator) {
  return op !== "is_null" && op !== "is_not_null";
}

/** A filter only affects the query once it has a field and (if needed) a value. */
export function isFilterActive(filter: TableFilter) {
  if (!filter.field) return false;
  return !operatorNeedsValue(filter.op) || filter.value.trim() !== "";
}

/**
 * Drops filters that are incomplete or point at columns the current table
 * doesn't have (stale view, different database, dropped column), so a bad
 * filter can never reach the server or break the grid.
 */
export function sanitizeFilters(
  filters: TableFilter[],
  columnNames: string[]
): TableFilter[] {
  const known = new Set(columnNames);
  return filters.filter((f) => known.has(f.field) && isFilterActive(f));
}

export function filtersEqual(a: TableFilter[], b: TableFilter[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function describeFilter(f: TableFilter) {
  return operatorNeedsValue(f.op)
    ? `${f.field} ${OPERATOR_LABELS[f.op]} ${f.value}`
    : `${f.field} ${OPERATOR_LABELS[f.op]}`;
}
