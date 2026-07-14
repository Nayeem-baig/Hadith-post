import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[#0d1116] px-2.5 py-0.5 text-xs font-medium text-[#d8dce2]", className)} {...props} />;
}
