"use client";

import { useState } from "react";
import { ConnectionForm } from "@/components/database/connection-form";
import { DataGrid } from "@/components/tables/data-grid";
import { SchemaViewer } from "@/components/tables/schema-viewer";
import { SqlConsole } from "@/components/sql-console/sql-editor";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ErrorBoundary } from "@/components/error-boundary";
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

type Tab = "data" | "schema";

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
          <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-fill opacity-[0.07] blur-3xl" />
        </div>
        <div className="relative mb-10 max-w-md text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fill">
            <Database className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
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
  const sessionKey = `${session?.id}:${session?.database}`;
  return (
    <ErrorBoundary key={sessionKey}>
      <DashboardContent />
    </ErrorBoundary>
  );
}

function DashboardContent() {
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    name: string;
  } | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
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
          selected={selectedTable && { ...selectedTable, viewId: activeViewId }}
          onSelectTable={(t, viewId = null) => {
            setSelectedTable(t);
            setActiveViewId(viewId);
            setSqlOnly(false);
            setActiveTab("data");
          }}
          sqlActive={sqlActive}
          onOpenSql={() => {
            setSqlOnly(true);
            setSelectedTable(null);
            setActiveViewId(null);
            setActiveTab("data");
          }}
        />
      }
    >
      {selectedTable ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 flex-col gap-0 border-b border-border bg-background px-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2 py-2.5 sm:mr-6">
              <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-semibold">{tableLabel}</span>
            </div>
            <nav className="-mb-px flex gap-1">
              {(
                [
                  { id: "data" as const, label: "Data", icon: Rows3 },
                  { id: "schema" as const, label: "Schema", icon: Columns3 },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
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
                key={`${selectedTable.schema}.${selectedTable.name}`}
                viewId={activeViewId}
                onViewChange={setActiveViewId}
                tableName={selectedTable.name}
                schema={selectedTable.schema}
              />
            )}
            {activeTab === "schema" && (
              <div className="no-scrollbar h-full overflow-auto p-4">
                <SchemaViewer
                  tableName={selectedTable.name}
                  schema={selectedTable.schema}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">SQL Editor</span>
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
