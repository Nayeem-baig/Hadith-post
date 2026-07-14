import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  className
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full border border-[var(--panel-border)] transition-colors", checked ? "bg-[var(--gold)]" : "bg-[#0d1116]", className)}
    >
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
