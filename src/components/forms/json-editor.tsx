"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function JsonEditor({ value, onChange, disabled }: JsonEditorProps) {
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
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className="font-mono text-xs min-h-[100px]"
        placeholder="{}"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
