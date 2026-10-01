import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-[13px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-fill/25 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
