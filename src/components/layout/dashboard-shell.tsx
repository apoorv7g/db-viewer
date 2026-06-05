"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Database, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/database/connection-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const SIDEBAR_WIDTH_KEY = "db-viewer-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 224;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function readStoredSidebarWidth() {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (!stored) return DEFAULT_SIDEBAR_WIDTH;
  const parsed = Number.parseInt(stored, 10);
  return Number.isNaN(parsed) ? DEFAULT_SIDEBAR_WIDTH : clampSidebarWidth(parsed);
}

interface DashboardShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ sidebar, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setSidebarWidth(readStoredSidebarWidth());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      event.preventDefault();
      resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isDesktop, sidebarWidth]
  );

  const handleResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const delta = event.clientX - resizeRef.current.startX;
    setSidebarWidth(clampSidebarWidth(resizeRef.current.startWidth + delta));
  }, []);

  const handleResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    setIsResizing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setSidebarWidth((width) => {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
      return width;
    });
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary-muted">
            <Database className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="truncate text-sm font-semibold">DB Viewer</span>
        </div>

        <div className="mx-1 hidden h-4 w-px bg-border sm:block" />

        <div className="min-w-0 flex-1">
          <ConnectionStatus compact />
        </div>

        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar pt-11 transition-transform duration-200 lg:static lg:relative lg:pt-0 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            isResizing && "select-none"
          )}
          style={isDesktop ? { width: sidebarWidth } : undefined}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 lg:hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Navigation
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col"
            onClick={() => setSidebarOpen(false)}
          >
            {sidebar}
          </div>

          {isDesktop && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              className={cn(
                "absolute right-0 top-0 z-10 h-full w-1.5 -mr-px cursor-col-resize touch-none",
                "hover:bg-primary/25 active:bg-primary/40",
                isResizing && "bg-primary/40"
              )}
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
            />
          )}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
