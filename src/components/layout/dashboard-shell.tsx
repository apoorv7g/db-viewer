"use client";

import { useState, type ReactNode } from "react";
import { Database, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/database/connection-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

interface DashboardShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ sidebar, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar pt-11 transition-transform duration-200 lg:static lg:w-56 lg:pt-0 lg:translate-x-0 xl:w-60",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
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
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
