"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Play, History, Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { apiFetch } from "@/lib/api-client";
import { formatDuration } from "@/lib/utils";
import type { QueryResult, SqlSafetyAnalysis } from "@/types/database";
import { useConnection } from "@/hooks/use-connection";
import { downloadFile, exportToCsv } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-48 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-md text-sm text-zinc-500">
      Loading editor…
    </div>
  ),
});

const HISTORY_KEY = "db-viewer-query-history";
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(queries: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(queries.slice(0, MAX_HISTORY)));
}

interface QueryResponse extends QueryResult {
  requiresConfirmation?: boolean;
  safety?: SqlSafetyAnalysis;
  message?: string;
  readOnly?: boolean;
}

export function SqlConsole() {
  const { session } = useConnection();
  const [sql, setSql] = useState("SELECT 1;");
  const [limit, setLimit] = useState(session?.resultLimit ?? 1000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSql, setPendingSql] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const runQuery = async (querySql: string, confirmed = false) => {
    setLoading(true);
    try {
      const res = await apiFetch<QueryResponse>("/api/query", {
        method: "POST",
        body: JSON.stringify({ sql: querySql, limit, confirmed }),
      });
      if (res.requiresConfirmation) {
        setPendingSql(querySql);
        setConfirmOpen(true);
        setResult(res);
        return;
      }
      setResult(res);
      const newHistory = [querySql, ...history.filter((q) => q !== querySql)].slice(
        0,
        MAX_HISTORY
      );
      setHistory(newHistory);
      saveHistory(newHistory);
      toast.success(
        `${res.rowCount} rows in ${formatDuration(res.executionTimeMs)}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Query failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = (format: "csv" | "json") => {
    if (!result?.rows.length) return;
    const cols = result.fields.map((f) => f.name);
    if (format === "csv") {
      downloadFile(
        exportToCsv(cols, result.rows),
        "query-results.csv",
        "text/csv"
      );
    } else {
      downloadFile(
        JSON.stringify(result.rows, null, 2),
        "query-results.json",
        "application/json"
      );
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => runQuery(sql)} disabled={loading}>
          <Play className="h-4 w-4" />
          {loading ? "Running…" : "Run"}
        </Button>
        <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
          <History className="h-4 w-4" />
          History
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-zinc-500">Limit</span>
          <Input
            type="number"
            className="w-24"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            min={1}
            max={10000}
          />
        </div>
      </div>

      {showHistory && history.length > 0 && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2 max-h-32 overflow-y-auto">
          {history.map((q, i) => (
            <button
              key={i}
              type="button"
              className="block w-full text-left text-xs font-mono p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded truncate"
              onClick={() => {
                setSql(q);
                setShowHistory(false);
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[200px]">
        <MonacoEditor
          height="200px"
          language="sql"
          theme="vs-dark"
          value={sql}
          onChange={(v) => setSql(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {result && (
        <div className="flex-1 flex flex-col min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-md">
          <div className="flex items-center gap-2 p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <Badge variant="secondary">{result.rowCount} rows</Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(result.executionTimeMs)}
            </Badge>
            {result.truncated && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Truncated
              </Badge>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => exportResults("csv")}>
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportResults("json")}>
              JSON
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {result.fields.map((f) => (
                    <th key={f.name} className="text-left px-3 py-2 font-medium border-b">
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                    {result.fields.map((f) => (
                      <td key={f.name} className="px-3 py-1 font-mono max-w-xs truncate">
                        {row[f.name] === null
                          ? "NULL"
                          : typeof row[f.name] === "object"
                            ? JSON.stringify(row[f.name])
                            : String(row[f.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm SQL execution"
        description={
          result?.message ??
          "This query may modify data. Are you sure you want to proceed?"
        }
        variant="destructive"
        confirmLabel="Execute query"
        onConfirm={() => {
          setConfirmOpen(false);
          runQuery(pendingSql, true);
        }}
        preview={result?.safety}
      />
    </div>
  );
}
