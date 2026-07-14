"use client";

import { useMemo, useState } from "react";
import { RouteShell } from "@/components/studio/RouteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStudioDb } from "@/hooks/use-studio-db";
import { upsertHashtagGroup } from "@/lib/persistence";

export default function HashtagsPage() {
  const { db, setDb, ready } = useStudioDb();
  const [name, setName] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return db.hashtags.filter((group) => !term || [group.name, group.hashtags.join(" ")].some((field) => field.toLowerCase().includes(term)));
  }, [db.hashtags, search]);

  function saveGroup() {
    const tags = hashtags
      .split(/\n|,/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
    if (!name.trim() || !tags.length) return;
    const now = new Date().toISOString();
    setDb((current) =>
      upsertHashtagGroup(current, {
        id: `hashtags-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: name.trim(),
        hashtags: tags,
        favorite: false,
        createdAt: now,
        updatedAt: now
      })
    );
    setName("");
    setHashtags("");
  }

  function toggleFavorite(id: string) {
    setDb((current) => ({
      ...current,
      hashtags: current.hashtags.map((group) => (group.id === id ? { ...group, favorite: !group.favorite, updatedAt: new Date().toISOString() } : group))
    }));
  }

  function deleteGroup(id: string) {
    setDb((current) => ({ ...current, hashtags: current.hashtags.filter((group) => group.id !== id) }));
  }

  function reuseGroup(id: string) {
    window.localStorage.setItem("hadith-studio-pending-hashtag-group", id);
    window.location.href = "/";
  }

  return (
    <RouteShell title="Hashtag Library" description="Reusable hashtag groups for fast post creation.">
      <Card className="border-[var(--panel-border)] bg-[#11161d]">
        <CardHeader>
          <CardTitle className="text-[var(--gold-soft)]">Hashtag groups</CardTitle>
          <CardDescription>Create, favorite, reuse, and delete grouped hashtags.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Group name" value={name} onChange={(event) => setName(event.target.value)} />
            <Input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Button onClick={saveGroup}>Save Group</Button>
          </div>
          <Textarea
            value={hashtags}
            onChange={(event) => setHashtags(event.target.value)}
            placeholder={"#Islam\n#Hadith\n#Muslim"}
            className="min-h-32"
          />
          {!ready ? <div className="text-sm text-[var(--text-dim)]">Loading hashtag library…</div> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <Card key={group.id} className="border-[var(--panel-border)] bg-[#0d1116]">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      <CardDescription className="text-xs">{new Date(group.updatedAt).toLocaleString()}</CardDescription>
                    </div>
                    <Badge>{group.favorite ? "Favorite" : "Group"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {group.hashtags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[var(--panel-border)] bg-[#11161d] px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => reuseGroup(group.id)}>Reuse</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleFavorite(group.id)}>
                      {group.favorite ? "★ Unfavorite" : "★ Favorite"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteGroup(group.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {!groups.length ? <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[#0d1116] px-4 py-8 text-sm text-[var(--text-dim)]">No hashtag groups yet.</div> : null}
        </CardContent>
      </Card>
    </RouteShell>
  );
}
