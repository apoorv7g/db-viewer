"use client";

import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableList } from "@/components/tables/table-list";

interface SidebarNavProps {
  selected?: { schema: string; name: string } | null;
  onSelectTable: (table: { schema: string; name: string }) => void;
  sqlActive?: boolean;
  onOpenSql: () => void;
}

export function SidebarNav({
  selected,
  onSelectTable,
  sqlActive,
  onOpenSql,
}: SidebarNavProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-0.5 border-b border-border p-2">
        <button
          type="button"
          data-active={sqlActive}
          onClick={onOpenSql}
          className={cn("studio-sidebar-item w-full")}
        >
          <Terminal className="sidebar-item-icon h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">SQL runner</span>
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <TableList selected={selected} onSelect={onSelectTable} />
      </div>
    </div>
  );
}
