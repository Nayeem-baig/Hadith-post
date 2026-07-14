import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ className, value = 0 }: { className?: string; value?: number }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[#0d1116]", className)}>
      <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
