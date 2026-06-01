"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Play,
  History,
  Clock,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { apiFetch } from "@/lib/api-client";
import { formatDuration } from "@/lib/utils";
import type { QueryResult, SqlSafetyAnalysis } from "@/types/database";
import { useConnection } from "@/hooks/use-connection";
import { useTheme } from "@/components/theme-provider";
import { downloadFile, exportToCsv } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center gap-2 rounded-lg bg-surface text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      Loading editor
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
  const { theme } = useTheme();
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
    <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => runQuery(sql)}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? "Running…" : "Run"}
        </Button>
        <Button
          variant={showHistory ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="h-4 w-4" />
          History
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-500">Limit</span>
          <Input
            type="number"
            className="w-20 sm:w-24"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            min={1}
            max={10000}
          />
        </div>
      </div>

      {showHistory && history.length > 0 && (
        <div className="studio-panel max-h-32 overflow-y-auto p-2">
          {history.map((q, i) => (
            <button
              key={i}
              type="button"
              className="block w-full rounded-md p-2 text-left font-mono text-xs text-zinc-400 transition-colors hover:bg-surface-hover hover:text-zinc-200 truncate"
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

      <div className="studio-panel shrink-0 overflow-hidden rounded-lg">
        <MonacoEditor
          height="176px"
          language="sql"
          theme={theme === "dark" ? "vs-dark" : "vs"}
          value={sql}
          onChange={(v) => setSql(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-geist-mono), monospace",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            lineNumbers: "on",
            renderLineHighlight: "line",
          }}
        />
      </div>

      {result && (
        <div className="studio-panel flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
            <Badge variant="secondary">{result.rowCount} rows</Badge>
            <Badge variant="outline" className="gap-1 tabular-nums">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportResults("csv")}
              disabled={!result.rows.length}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportResults("json")}
              disabled={!result.rows.length}
            >
              <FileJson className="h-3.5 w-3.5" />
              JSON
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="studio-table w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border">
                  {result.fields.map((f) => (
                    <th key={f.name} className="px-3 py-2.5 whitespace-nowrap">
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-subtle"
                  >
                    {result.fields.map((f) => (
                      <td
                        key={f.name}
                        className="max-w-xs truncate font-mono text-xs"
                      >
                        {row[f.name] === null ? (
                          <span className="italic text-zinc-600">NULL</span>
                        ) : typeof row[f.name] === "object" ? (
                          JSON.stringify(row[f.name])
                        ) : (
                          String(row[f.name])
                        )}
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
