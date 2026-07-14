"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const links = [
  { href: "/", label: "Editor" },
  { href: "/projects", label: "Library" },
  { href: "/assets", label: "Assets" },
  { href: "/hashtags", label: "Hashtags" },
  { href: "/favorites", label: "Favorites" },
  { href: "/buffer", label: "Buffer" },
  { href: "/settings", label: "Settings" }
];

export function RouteShell({
  title,
  description,
  children,
  actions
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0a0d11] px-4 py-4 text-[#e8e8e8]">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-[var(--panel-border)] bg-[#11161d] px-4 py-4 shadow-stage">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="font-['Cormorant_Garamond',serif] text-3xl font-semibold text-[var(--gold-soft)]">{title}</h1>
              <p className="text-sm text-[var(--text-dim)]">{description}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {actions}
              <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--panel-border)] bg-transparent px-4 py-2 text-sm font-medium text-[#e8e8e8] transition-colors hover:border-[var(--gold)]">
                Open Editor
              </Link>
            </div>
          </div>
          <Separator className="my-4 bg-[var(--panel-border)]" />
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 text-xs font-medium text-[#d8dce2] transition-colors hover:border-[var(--gold)]">
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
