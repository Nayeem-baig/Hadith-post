"use client";

import { useEffect, useMemo, useState } from "react";
import { RouteShell } from "@/components/studio/RouteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStudioDb } from "@/hooks/use-studio-db";
import type { BufferChannel, BufferPostRecord } from "@/types/studio";

type BufferBootstrapResponse = {
  configured: boolean;
  error?: string;
  organizations: Array<{ id: string; name: string }>;
  channels: BufferChannel[];
  posts: BufferPostRecord[];
};

function formatBufferStatus(status?: string) {
  if (!status) return "queue";
  return status.toLowerCase();
}

export default function BufferPage() {
  const { db, ready } = useStudioDb();
  const [bootstrap, setBootstrap] = useState<BufferBootstrapResponse>({
    configured: false,
    organizations: [],
    channels: [],
    posts: []
  });
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pendingProjectId = typeof window !== "undefined" ? window.localStorage.getItem("hadith-studio-buffer-pending-project") : null;
  const pendingProject = db.projects.find((project) => project.id === pendingProjectId);
  const preparedMedia = pendingProject?.buffer;

  const postsByStatus = useMemo(() => {
    return {
      queue: bootstrap.posts.filter((post) => formatBufferStatus(post.status) === "queue"),
      scheduled: bootstrap.posts.filter((post) => formatBufferStatus(post.status) === "scheduled"),
      published: bootstrap.posts.filter((post) => ["sent", "published"].includes(formatBufferStatus(post.status))),
      failed: bootstrap.posts.filter((post) => formatBufferStatus(post.status) === "failed")
    };
  }, [bootstrap.posts]);

  useEffect(() => {
    if (!pendingProject) return;
    setTitle((current) => current || pendingProject.title);
    setCaption((current) => current || pendingProject.caption || pendingProject.englishText || pendingProject.arabicText || "");
    setTags((current) => current || (pendingProject.hashtags || []).join(", "));
    setCategory((current) => current || pendingProject.buffer?.category || "");
  }, [pendingProject]);

  useEffect(() => {
    let active = true;
    async function loadBootstrap(nextOrganizationId?: string) {
      setLoading(true);
      try {
        const url = nextOrganizationId ? `/api/buffer/bootstrap?organizationId=${encodeURIComponent(nextOrganizationId)}` : "/api/buffer/bootstrap";
        const response = await fetch(url, { cache: "no-store" });
        const payload = (await response.json()) as BufferBootstrapResponse;
        if (!active) return;
        setBootstrap(payload);
        setError(payload.error || "");
        if (!organizationId && payload.organizations[0]) {
          setOrganizationId(payload.organizations[0].id);
        }
      } catch (loadError) {
        console.error("Buffer bootstrap load failed:", loadError);
        if (active) {
          setError("Buffer dashboard could not load.");
          setBootstrap({ configured: false, organizations: [], channels: [], posts: [] });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadBootstrap(organizationId || undefined);
    return () => {
      active = false;
    };
    // intentionally refetch when organization changes
  }, [organizationId]);

  useEffect(() => {
    setSelectedChannelIds([]);
  }, [organizationId]);

  useEffect(() => {
    if (!bootstrap.channels.length) return;
    setSelectedChannelIds((current) => (current.length ? current : bootstrap.channels.map((channel) => channel.id)));
  }, [bootstrap.channels]);

  function toggleChannel(id: string) {
    setSelectedChannelIds((current) =>
      current.includes(id) ? current.filter((channelId) => channelId !== id) : [...current, id]
    );
  }

  function selectedChannels() {
    return bootstrap.channels.filter((channel) => selectedChannelIds.includes(channel.id));
  }

  async function publishToBuffer(saveToDraft = false) {
    if (!organizationId) {
      setError("Select a Buffer organization first.");
      return;
    }
    if (!selectedChannelIds.length) {
      setError("Select at least one channel.");
      return;
    }
    if (!preparedMedia?.mediaUrl) {
      setError("No exported media is attached to this project. Click Post to Buffer from the editor again.");
      return;
    }
    const nextCaption = caption.trim() || pendingProject?.caption || pendingProject?.englishText || pendingProject?.arabicText || "";
    const nextTitle = title.trim() || pendingProject?.title || "Buffer post";
    setPublishing(true);
    setError("");
    setSuccess("");
    try {
    const response = await fetch("/api/buffer/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        channels: selectedChannels().map((channel) => ({ id: channel.id, service: channel.service })),
        title: nextTitle,
        caption: nextCaption,
        category: category.trim() || preparedMedia.category,
        tags: tags
          .split(/,|\n/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        saveToDraft,
        projectId: pendingProject?.id,
        mediaUrl: preparedMedia.mediaUrl,
        mediaKind: preparedMedia.mediaKind,
        mediaType: preparedMedia.mediaType,
        fileName: preparedMedia.fileName
      })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Buffer publish failed.");
      }
      setSuccess(saveToDraft ? "Saved as Buffer draft." : "Queued in Buffer.");
      setCaption("");
      setTitle("");
      setTags("");
      setScheduledAt("");
      const refresh = await fetch(`/api/buffer/bootstrap?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      if (refresh.ok) {
        const refreshed = (await refresh.json()) as BufferBootstrapResponse;
        setBootstrap(refreshed);
      }
    } catch (publishError) {
      console.error("Buffer publish failed:", publishError);
      setError(publishError instanceof Error ? publishError.message : "Buffer publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <RouteShell title="Buffer Dashboard" description="Select channels, queue posts, and inspect Buffer queue state.">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-[var(--panel-border)] bg-[#11161d] xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Queue post</CardTitle>
            <CardDescription>Choose channels, then queue or draft the post in Buffer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
              {bootstrap.configured ? "Buffer is configured." : "Buffer is not configured."}
            </div>
            {preparedMedia?.mediaUrl ? (
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-xs text-[var(--text-dim)]">
                Prepared media: {preparedMedia.mediaKind || "image"} · {preparedMedia.fileName || "export"}
              </div>
            ) : null}
            {error ? <div className="rounded-md border border-[#7d2b2b] bg-[#2a1010] px-3 py-2 text-sm text-[#ffb4b4]">{error}</div> : null}
            {success ? <div className="rounded-md border border-[#295d34] bg-[#102015] px-3 py-2 text-sm text-[#b7f1c2]">{success}</div> : null}
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Organization</span>
              <select
                className="w-full rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 outline-none"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                <option value="">Select organization</option>
                {bootstrap.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Textarea placeholder="Caption" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-28" />
            <Input placeholder="Tags, comma separated" value={tags} onChange={(event) => setTags(event.target.value)} />
            <Input placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            <div className="space-y-2 rounded-md border border-[var(--panel-border)] bg-[#0d1116] p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Channels</div>
              <div className="space-y-2">
                {bootstrap.channels.map((channel) => (
                  <label key={channel.id} className="flex items-center gap-3 rounded-md border border-[var(--panel-border)] bg-[#11161d] px-3 py-2 text-sm">
                    <input type="checkbox" checked={selectedChannelIds.includes(channel.id)} onChange={() => toggleChannel(channel.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{channel.displayName || channel.name}</span>
                      <span className="block text-xs text-[var(--text-dim)]">{channel.service}</span>
                    </span>
                    {channel.isQueuePaused ? <Badge className="bg-[#3a2626] text-[#ffb4b4]">Paused</Badge> : <Badge>Active</Badge>}
                  </label>
                ))}
                {!bootstrap.channels.length && !loading ? <div className="text-sm text-[var(--text-dim)]">No channels loaded.</div> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => publishToBuffer(false)} disabled={publishing || !bootstrap.configured}>
                {publishing ? "Loading..." : "Queue Post"}
              </Button>
              <Button variant="secondary" onClick={() => publishToBuffer(true)} disabled={publishing || !bootstrap.configured}>
                Save Draft
              </Button>
            </div>
            <div className="text-xs text-[var(--text-dim)]">
              Optional fields: title, category, tags, schedule time. Buffer keeps the selected channels as separate queued posts.
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--panel-border)] bg-[#11161d] xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Buffer queue</CardTitle>
            <CardDescription>Live posts fetched from Buffer and mirrored into MongoDB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Accounts</div>
                <div className="mt-1 text-lg font-semibold">{bootstrap.organizations.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Drafts</div>
                <div className="mt-1 text-lg font-semibold">{bootstrap.posts.filter((post) => formatBufferStatus(post.status) === "draft").length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Queue</div>
                <div className="mt-1 text-lg font-semibold">{postsByStatus.queue.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Scheduled</div>
                <div className="mt-1 text-lg font-semibold">{postsByStatus.scheduled.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Published</div>
                <div className="mt-1 text-lg font-semibold">{postsByStatus.published.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Failed</div>
                <div className="mt-1 text-lg font-semibold">{postsByStatus.failed.length}</div>
              </div>
            </div>
            {!ready || loading ? <div className="text-sm text-[var(--text-dim)]">Loading Buffer data…</div> : null}
            <div className="space-y-3">
              {bootstrap.posts.map((post) => (
                <div key={post.id} className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{post.text.slice(0, 90)}</div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {post.channelId} · {post.dueAt || "Queue"} · {post.createdAt ? new Date(post.createdAt).toLocaleString() : "Unknown"}
                      </div>
                    </div>
                    <Badge>{formatBufferStatus(post.status)}</Badge>
                  </div>
                </div>
              ))}
              {!bootstrap.posts.length && !loading ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[#0d1116] px-4 py-8 text-sm text-[var(--text-dim)]">
                  No Buffer posts loaded yet.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteShell>
  );
}
