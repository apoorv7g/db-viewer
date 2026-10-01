"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { convertToIst, type ConvertedTime, type TimeKind } from "@/lib/time";

const HOVER_DELAY_MS = 1500;

interface TimeHoverProps {
  value: unknown;
  kind: TimeKind | null;
  children: ReactNode;
}

/**
 * Wraps a cell and, after the pointer rests on it for 1.5s, shows the value in
 * IST. Nothing is computed until then, so scrolling/moving over a big grid is
 * free.
 */
export function TimeHover({ value, kind, children }: TimeHoverProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<{
    time: ConvertedTime;
    x: number;
    y: number;
  } | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setTip(null);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  if (!kind || value === null || value === undefined) return <>{children}</>;

  return (
    <div
      className="min-w-0 flex-1"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        timer.current = setTimeout(() => {
          const time = convertToIst(value, kind);
          if (time) setTip({ time, x: rect.left, y: rect.bottom + 6 });
        }, HOVER_DELAY_MS);
      }}
      onMouseLeave={cancel}
      onMouseDown={cancel}
    >
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] rounded-md border border-border bg-card px-3 py-2 text-xs shadow-xl shadow-black/30"
          style={{
            left: Math.max(8, Math.min(tip.x, window.innerWidth - 280)),
            top: Math.min(tip.y, window.innerHeight - 90),
          }}
        >
          <p className="font-mono text-[13px] font-medium text-foreground">
            {tip.time.ist}
          </p>
          <p className="mt-1 font-mono text-muted-foreground">{tip.time.utc}</p>
          <p className="mt-1 text-[11px] text-muted">{tip.time.note}</p>
        </div>
      )}
    </div>
  );
}
