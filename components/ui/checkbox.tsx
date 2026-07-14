import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({
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
      className={cn("inline-flex h-5 w-5 items-center justify-center rounded border border-[var(--panel-border)] bg-[#0d1116] text-[var(--gold)]", className)}
    >
      {checked ? <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--gold)]" /> : null}
    </button>
  );
}
