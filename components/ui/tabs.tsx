import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
  return <div data-tabs={value}>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { value, onValueChange }) : child)}</div>;
}

export function TabsList({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-[#0d1116] p-1 text-[#d8dce2]", className)}>{children}</div>;
}

export function TabsTrigger({ value, currentValue, onValueChange, className, children }: { value: string; currentValue?: string; onValueChange?: (value: string) => void; className?: string; children: React.ReactNode }) {
  const active = currentValue === value;
  return (
    <button
      type="button"
      onClick={() => onValueChange?.(value)}
      className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all", active ? "bg-[var(--gold)] text-[#1a1200]" : "text-[#d8dce2]", className)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, currentValue, children, className }: { value: string; currentValue?: string; children: React.ReactNode; className?: string }) {
  if (value !== currentValue) return null;
  return <div className={className}>{children}</div>;
}
