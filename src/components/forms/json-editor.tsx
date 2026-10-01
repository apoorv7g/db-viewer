"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Stretch to fill the parent (parent must be a sized flex column). */
  fill?: boolean;
}

export function JsonEditor({ value, onChange, disabled, fill }: JsonEditorProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (text: string) => {
    onChange(text);
    if (!text.trim()) {
      setError(null);
      return;
    }
    try {
      JSON.parse(text);
      setError(null);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className={cn("space-y-1", fill && "flex h-full min-h-0 flex-col space-y-1")}>
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "min-h-40 rounded-lg px-3 py-2.5 font-mono text-xs leading-6",
          fill && "min-h-0 flex-1 resize-none"
        )}
        placeholder="{}"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
