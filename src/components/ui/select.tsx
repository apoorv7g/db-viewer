import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    className={cn(
      "flex h-9 w-full appearance-none rounded-lg border border-border bg-surface bg-no-repeat px-3 py-2 pr-9 text-sm text-foreground shadow-sm transition-colors [background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")] bg-position-[right_0.65rem_center] bg-size-[0.9rem] hover:border-muted focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
