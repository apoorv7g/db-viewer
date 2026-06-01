"use client";

import { useState } from "react";
import { ConnectionForm } from "@/components/database/connection-form";
import { ConnectionStatus } from "@/components/database/connection-status";
import { TableList } from "@/components/tables/table-list";
import { DataGrid } from "@/components/tables/data-grid";
import { SchemaViewer } from "@/components/tables/schema-viewer";
import { SqlConsole } from "@/components/sql-console/sql-editor";
import { useConnection } from "@/hooks/use-connection";
import { Database, Terminal, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "data" | "schema" | "sql";

export default function DashboardPage() {
  const { connected, isLoading } = useConnection();
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    name: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("data");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="mb-8 text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
          <h1 className="text-2xl font-bold">DB Viewer</h1>
          <p className="text-zinc-500 mt-2">
            Lightweight PostgreSQL administration  fast, safe, and simple.
          </p>
        </div>
        <ConnectionForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Database className="h-5 w-5" />
        <h1 className="font-semibold">DB Viewer</h1>
      </header>
      <ConnectionStatus />
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Tables
          </div>
          <TableList
            selected={selectedTable}
            onSelect={(t) => {
              setSelectedTable(t);
              setActiveTab("data");
            }}
          />
        </aside>
        <main className="flex-1 flex flex-col min-w-0">
          {selectedTable ? (
            <>
              <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <Table2 className="h-4 w-4 text-zinc-400" />
                <span className="font-medium">
                  {selectedTable.schema}.{selectedTable.name}
                </span>
                <div className="flex-1" />
                <nav className="flex gap-1">
                  {(
                    [
                      { id: "data" as const, label: "Data" },
                      { id: "schema" as const, label: "Schema" },
                      { id: "sql" as const, label: "SQL" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "px-3 py-1 text-sm rounded-md",
                        activeTab === tab.id
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="flex-1 min-h-0">
                {activeTab === "data" && (
                  <DataGrid
                    tableName={selectedTable.name}
                    schema={selectedTable.schema}
                  />
                )}
                {activeTab === "schema" && (
                  <div className="p-4 overflow-auto h-full">
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
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <Terminal className="h-4 w-4" />
                <span className="font-medium">SQL Console</span>
              </div>
              <div className="flex-1 min-h-0">
                <SqlConsole />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
