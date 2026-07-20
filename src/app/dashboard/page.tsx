"use client";

import { useState } from "react";
import { ConnectionForm } from "@/components/database/connection-form";
import { DataGrid } from "@/components/tables/data-grid";
import { SchemaViewer } from "@/components/tables/schema-viewer";
import { SqlConsole } from "@/components/sql-console/sql-editor";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConnection } from "@/hooks/use-connection";
import {
  Database,
  Loader2,
  Table2,
  Columns3,
  Rows3,
  Terminal,
} from "lucide-react";

type Tab = "data" | "schema" | "sql";

export default function DashboardPage() {
  const { session, connected, isLoading } = useConnection();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 sm:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary opacity-[0.06] blur-3xl" />
        </div>
        <div className="relative mb-10 max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted ring-1 ring-primary/20">
            <Database className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            DB Viewer
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Browse tables, edit rows, and run SQL. Session-only connections with
            no credentials stored on disk.
          </p>
        </div>
        <ConnectionForm />
      </div>
    );
  }

  // Remounting on connection/database change gives switching a database the
  // same fresh-start UI as connecting for the first time (cleared selection,
  // reset tabs, no stale component state carried over).
  return <DashboardContent key={`${session?.id}:${session?.database}`} />;
}

function DashboardContent() {
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    name: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [sqlOnly, setSqlOnly] = useState(false);

  const sqlActive = sqlOnly && !selectedTable;
  const tableLabel = selectedTable
    ? `${selectedTable.schema}.${selectedTable.name}`
    : null;

  return (
    <DashboardShell
      sidebar={
        <SidebarNav
          selected={selectedTable}
          onSelectTable={(t) => {
            setSelectedTable(t);
            setSqlOnly(false);
            setActiveTab("data");
          }}
          sqlActive={sqlActive}
          onOpenSql={() => {
            setSqlOnly(true);
            setSelectedTable(null);
            setActiveTab("sql");
          }}
        />
      }
    >
      {selectedTable ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-3 py-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <Table2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{tableLabel}</span>
            </div>
            <nav className="flex gap-0.5 overflow-x-auto sm:ml-auto">
              {(
                [
                  { id: "data" as const, label: "Data", icon: Rows3 },
                  { id: "schema" as const, label: "Schema", icon: Columns3 },
                  { id: "sql" as const, label: "SQL", icon: Terminal },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSqlOnly(tab.id === "sql");
                  }}
                  data-active={activeTab === tab.id}
                  className="studio-tab shrink-0"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="min-h-0 flex-1">
            {activeTab === "data" && (
              <DataGrid
                tableName={selectedTable.name}
                schema={selectedTable.schema}
              />
            )}
            {activeTab === "schema" && (
              <div className="h-full overflow-auto p-4">
                <SchemaViewer
                  tableName={selectedTable.name}
                  schema={selectedTable.schema}
                />
              </div>
            )}
            {activeTab === "sql" && (
              <div className="h-full min-h-0">
                <SqlConsole />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">SQL runner</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Run queries against your database
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <SqlConsole />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
