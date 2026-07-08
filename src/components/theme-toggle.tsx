"use client";

import { Ghost, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const LABELS = {
  light: "Switch to dark mode",
  dark: "Switch to Dracula theme",
  dracula: "Switch to light mode",
} as const;

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={toggleTheme}
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : theme === "dark" ? (
        <Ghost className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}
