"use client";

import { RouteShell } from "@/components/studio/RouteShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudioDb } from "@/hooks/use-studio-db";

export default function FavoritesPage() {
  const { db, ready } = useStudioDb();

  const favoriteProjects = db.projects.filter((project) => project.favorite);
  const favoriteAssets = db.assets.filter((asset) => asset.favorite);
  const favoriteHashtags = db.hashtags.filter((group) => group.favorite);

  return (
    <RouteShell title="Favorites" description="Saved projects, backgrounds, audio, templates, and hashtag groups you marked for quick reuse.">
      {!ready ? <div className="text-sm text-[var(--text-dim)]">Loading favorites…</div> : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-[var(--panel-border)] bg-[#11161d]">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Projects</CardTitle>
            <CardDescription>Favorite projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {favoriteProjects.map((project) => (
              <div key={project.id} className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{project.title}</span>
                  <Badge>{project.status}</Badge>
                </div>
              </div>
            ))}
            {!favoriteProjects.length ? <div className="text-sm text-[var(--text-dim)]">No favorite projects. Use the ★ Favorite button on project cards.</div> : null}
          </CardContent>
        </Card>

        <Card className="border-[var(--panel-border)] bg-[#11161d]">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Assets</CardTitle>
            <CardDescription>Favorite background and audio uploads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {favoriteAssets.map((asset) => (
              <div key={asset.id} className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{asset.name}</span>
                  <Badge>{asset.kind}</Badge>
                </div>
              </div>
            ))}
            {!favoriteAssets.length ? <div className="text-sm text-[var(--text-dim)]">No favorite assets. Use the ★ Favorite button on asset cards.</div> : null}
          </CardContent>
        </Card>

        <Card className="border-[var(--panel-border)] bg-[#11161d]">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Hashtag Groups</CardTitle>
            <CardDescription>Favorite hashtag collections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {favoriteHashtags.map((group) => (
              <div key={group.id} className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{group.name}</span>
                  <Badge>Group</Badge>
                </div>
              </div>
            ))}
            {!favoriteHashtags.length ? <div className="text-sm text-[var(--text-dim)]">No favorite hashtag groups. Use the ★ Favorite button on hashtag cards.</div> : null}
          </CardContent>
        </Card>
      </div>
    </RouteShell>
  );
}
