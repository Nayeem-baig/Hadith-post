"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error || "Login failed.");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      console.error("Login error:", submitError);
      setError("Login request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-[var(--panel-border)] bg-[#11161d]/95 shadow-[0_24px_80px_rgba(0,0,0,.45)]">
      <CardHeader>
        <CardTitle className="font-['Cormorant_Garamond',serif] text-3xl text-[var(--gold-soft)]">Hadith Studio</CardTitle>
        <CardDescription>Personal access only. Sign in with the credentials from environment variables.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Username</label>
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Password</label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </div>
          {error ? <p className="rounded-md border border-[#5f1a1a] bg-[#2a1111] px-3 py-2 text-sm text-[#ffb6b6]">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </Button>
        </form>
        <Separator />
        <p className="text-xs leading-5 text-[var(--text-dim)]">
          This build uses JWT session cookies, route protection, and local-first persistence until MongoDB, Cloudinary, and Buffer are configured.
        </p>
      </CardContent>
    </Card>
  );
}
