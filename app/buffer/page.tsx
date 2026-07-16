"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RouteShell } from "@/components/studio/RouteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStudioDb } from "@/hooks/use-studio-db";
import type { BufferChannel, BufferPostRecord, BufferQueueItem } from "@/types/studio";

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

type ChannelSettings = {
  instagramTypes?: Array<"post" | "story" | "reel">;
  youtubeCategory?: string;
};

function defaultInstagramTypes(mediaKind?: string) {
  return (mediaKind === "video" ? ["reel"] : ["post"]) as Array<"post" | "story" | "reel">;
}

export default function BufferPage() {
  const { db, setDb, ready } = useStudioDb();
  const [bootstrap, setBootstrap] = useState<BufferBootstrapResponse>({
    configured: false,
    organizations: [],
    channels: [],
    posts: []
  });
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>({});
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedHashtagGroupId, setSelectedHashtagGroupId] = useState("");
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [editingQueueItemId, setEditingQueueItemId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const editorSectionRef = useRef<HTMLDivElement | null>(null);

  const pendingProjectId = typeof window !== "undefined" ? window.localStorage.getItem("hadith-studio-buffer-pending-project") : null;
  const pendingProject = db.projects.find((project) => project.id === pendingProjectId);
  const preparedMedia = pendingProject?.buffer;
  const hashtagGroups = db.hashtags;
  const audioAssets = useMemo(
    () => db.assets.filter((asset) => asset.kind === "audio").sort((left, right) => (right.updatedAt || right.createdAt).localeCompare(left.updatedAt || left.createdAt)),
    [db.assets]
  );
  const selectedHashtagGroup = hashtagGroups.find((group) => group.id === selectedHashtagGroupId);
  const selectedAudioAsset = audioAssets.find((asset) => asset.id === selectedAudioId);
  const queuedItems = db.bufferQueue;
  const editingQueueItem = queuedItems.find((item) => item.id === editingQueueItemId) || null;
  const bootstrapChannelById = useMemo(() => new Map(bootstrap.channels.map((channel) => [channel.id, channel])), [bootstrap.channels]);

  const queueByStatus = useMemo(() => {
    return {
      draft: queuedItems.filter((item) => item.status === "draft"),
      queue: queuedItems.filter((item) => item.status === "queue"),
      scheduled: queuedItems.filter((item) => item.status === "scheduled"),
      published: queuedItems.filter((item) => item.status === "published"),
      failed: queuedItems.filter((item) => item.status === "failed")
    };
  }, [queuedItems]);

  function resolveQueueItemService(item: BufferQueueItem) {
    const directService = item.service?.trim();
    if (directService && directService.toLowerCase() !== "buffer") return directService;
    const firstAccountId = item.accountIds[0];
    const matchedChannel = firstAccountId ? bootstrapChannelById.get(firstAccountId) : null;
    return matchedChannel?.service || "Buffer";
  }

  function resolveQueueItemPlatformType(item: BufferQueueItem) {
    if (item.platformType) return item.platformType;
    const service = resolveQueueItemService(item).toLowerCase();
    if (service.includes("instagram")) return "post";
    if (service.includes("youtube")) return "video";
    return item.mediaKind || "image";
  }

  function resolveQueueItemMediaKind(item: BufferQueueItem) {
    if (item.mediaKind) return item.mediaKind;
    if (item.platformType === "video") return "video";
    if (item.platformType === "image") return "image";
    return "image";
  }

  function queueItemLabel(item: BufferQueueItem) {
    if (item.platformLabel) return item.platformLabel;
    const service = resolveQueueItemService(item).toLowerCase();
    const platformType = resolveQueueItemPlatformType(item);
    if (service.includes("instagram")) {
      return `Instagram · ${platformType.charAt(0).toUpperCase() + platformType.slice(1)}`;
    }
    if (service.includes("youtube")) {
      return `YouTube · ${platformType === "video" ? "Video" : platformType}`;
    }
    return resolveQueueItemService(item);
  }

  function queueItemSummary(item: BufferQueueItem) {
    const channelCount = item.accountIds.length;
    const channelLabel = channelCount > 1 ? `${channelCount} channels` : "1 channel";
    const serviceLabel = queueItemLabel(item);
    const scheduled = item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "No schedule";
    return `${serviceLabel} · ${channelLabel} · ${scheduled}`;
  }

  function queueItemMediaLabel(item: BufferQueueItem) {
    const mediaKind = resolveQueueItemMediaKind(item);
    return mediaKind.charAt(0).toUpperCase() + mediaKind.slice(1);
  }

  function queueItemUploadLabel(item: BufferQueueItem) {
    if (item.fileName) {
      const extension = item.fileName.split(".").pop()?.trim().toUpperCase();
      if (extension) return extension;
    }
    const mediaKind = resolveQueueItemMediaKind(item);
    return mediaKind === "video" ? "VIDEO" : "IMAGE";
  }

  function loadQueueItemForEdit(item: BufferQueueItem) {
    const project = item.projectId ? db.projects.find((entry) => entry.id === item.projectId) : null;
    const projectBuffer = project?.buffer;
    setEditingQueueItemId(item.id);
    setSelectedHashtagGroupId("");
    setTitle(item.title || project?.title || "");
    setCaption(item.caption || projectBuffer?.caption || project?.caption || project?.englishText || project?.arabicText || "");
    setTags((item.tags || project?.hashtags || []).join(", "));
    setCategory(projectBuffer?.category || projectBuffer?.mediaType || "");
    setScheduledAt(item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : "");
    const service = resolveQueueItemService(item).toLowerCase();
    setSelectedChannelIds(
      item.accountIds.length
        ? item.accountIds
        : bootstrap.channels.filter((channel) => channel.service.toLowerCase().includes(service.includes("youtube") ? "youtube" : "instagram")).map((channel) => channel.id)
    );
    setChannelSettings((current) => {
      const next = { ...current };
      for (const accountId of item.accountIds) {
        const channel = bootstrapChannelById.get(accountId);
        if (!channel) continue;
        const channelService = channel.service.toLowerCase();
        next[channel.id] = {
          instagramTypes: channelService.includes("instagram")
            ? [((resolveQueueItemPlatformType(item) || (projectBuffer?.mediaKind === "video" ? "reel" : "post")) as "post" | "story" | "reel")]
            : undefined,
          youtubeCategory: channelService.includes("youtube") ? (projectBuffer?.category || category) : undefined
        };
      }
      return next;
    });
    setSuccess(`Loaded ${item.status} for editing.`);
    window.setTimeout(() => {
      editorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openQueueItemEditor(item: BufferQueueItem, mode: "edit" | "schedule") {
    loadQueueItemForEdit(item);
    if (mode === "schedule" && !item.scheduledAt) {
      setScheduledAt(new Date().toISOString().slice(0, 16));
    }
  }

  useEffect(() => {
    if (!pendingProject) return;
    setTitle((current) => current || pendingProject.title);
    setCaption((current) => current || pendingProject.caption || pendingProject.englishText || pendingProject.arabicText || "");
    setTags((current) => current || (pendingProject.hashtags || []).join(", "));
    setCategory((current) => current || pendingProject.buffer?.category || "");
  }, [pendingProject]);

  useEffect(() => {
    if (!hashtagGroups.length) return;
    const pendingGroupId = typeof window !== "undefined" ? window.localStorage.getItem("hadith-studio-pending-hashtag-group") : null;
    const exactGroup =
      pendingProject?.hashtags?.length && hashtagGroups.find((group) => group.hashtags.length === pendingProject.hashtags.length && group.hashtags.every((tag) => pendingProject.hashtags.includes(tag)));
    const nextGroup = hashtagGroups.find((group) => group.id === pendingGroupId) || exactGroup;
    if (nextGroup) setSelectedHashtagGroupId(nextGroup.id);
  }, [hashtagGroups, pendingProject]);

  useEffect(() => {
    if (!selectedHashtagGroup) return;
    setTags(selectedHashtagGroup.hashtags.join(", "));
  }, [selectedHashtagGroup]);

  useEffect(() => {
    if (!selectedAudioAsset || typeof window === "undefined") return;
    window.localStorage.setItem("hadith-studio-pending-audio", selectedAudioAsset.sourceUrl);
    window.localStorage.setItem("hadith-studio-pending-audio-name", selectedAudioAsset.name);
  }, [selectedAudioAsset]);

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
    setChannelSettings({});
  }, [organizationId]);

  useEffect(() => {
    if (!bootstrap.channels.length) return;
    setSelectedChannelIds((current) => (current.length ? current : bootstrap.channels.map((channel) => channel.id)));
  }, [bootstrap.channels]);

  useEffect(() => {
    if (!bootstrap.channels.length) return;
    setChannelSettings((current) => {
      const next = { ...current };
      for (const channel of bootstrap.channels) {
        if (next[channel.id]) continue;
        const service = channel.service.toLowerCase();
        next[channel.id] = {
          instagramTypes: service.includes("instagram") ? defaultInstagramTypes(preparedMedia?.mediaKind) : undefined,
          youtubeCategory: service.includes("youtube") ? (preparedMedia?.category || "") : undefined
        };
      }
      return next;
    });
  }, [bootstrap.channels, preparedMedia?.category, preparedMedia?.mediaKind]);

  function toggleChannel(id: string) {
    setSelectedChannelIds((current) =>
      current.includes(id) ? current.filter((channelId) => channelId !== id) : [...current, id]
    );
    const channel = bootstrap.channels.find((item) => item.id === id);
    if (!channel) return;
    setChannelSettings((current) => ({
      ...current,
      [id]: current[id] || {
        instagramTypes: channel.service.toLowerCase().includes("instagram") ? defaultInstagramTypes(preparedMedia?.mediaKind) : undefined,
        youtubeCategory: channel.service.toLowerCase().includes("youtube") ? (preparedMedia?.category || "") : undefined
      }
    }));
  }

  function selectedChannels() {
    return bootstrap.channels.filter((channel) => selectedChannelIds.includes(channel.id));
  }

  function saveQueueItemLocally(nextStatus: BufferQueueItem["status"]) {
    if (!editingQueueItemId) return false;
    const nextTitle = title.trim() || pendingProject?.title || "Buffer post";
    const nextCaption = caption.trim() || pendingProject?.caption || pendingProject?.englishText || pendingProject?.arabicText || "";
    const nextTags = tags
      .split(/,|\n/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const nextScheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;
    const nextChannels = selectedChannels();
    const firstChannel = nextChannels[0];
    const service = firstChannel?.service || editingQueueItem?.service || "Buffer";
    const platformType =
      service.toLowerCase().includes("instagram")
        ? (channelSettings[firstChannel?.id || ""]?.instagramTypes?.[0] || (preparedMedia?.mediaKind === "video" ? "reel" : "post"))
        : service.toLowerCase().includes("youtube")
          ? "video"
          : preparedMedia?.mediaKind || "image";
    const platformLabel =
      service.toLowerCase().includes("instagram")
        ? `Instagram · ${platformType.charAt(0).toUpperCase() + platformType.slice(1)}`
        : service.toLowerCase().includes("youtube")
          ? `YouTube · ${channelSettings[firstChannel?.id || ""]?.youtubeCategory || category.trim() || "Video"}`
          : service;

    setDb((current) => ({
      ...current,
      bufferQueue: current.bufferQueue.map((item) =>
        item.id === editingQueueItemId
          ? {
              ...item,
              title: nextTitle,
              caption: nextCaption,
              tags: nextTags,
              scheduledAt: nextStatus === "draft" ? undefined : nextScheduledAt || item.scheduledAt,
              status: nextStatus,
              accountIds: nextChannels.length ? nextChannels.map((channel) => channel.id) : item.accountIds,
              service,
              platformType: platformType as BufferQueueItem["platformType"],
              platformLabel,
              mediaKind: preparedMedia?.mediaKind,
              mediaType: preparedMedia?.mediaType,
              fileName: preparedMedia?.fileName
            }
          : item
      ),
      projects: current.projects.map((project) =>
        project.id === (editingQueueItem?.projectId || pendingProject?.id)
          ? {
              ...project,
              title: nextTitle,
              caption: nextCaption,
              hashtags: nextTags,
              buffer: project.buffer
                ? {
                    ...project.buffer,
                    title: nextTitle,
                    caption: nextCaption,
                    tags: nextTags,
                    scheduledAt: nextScheduledAt,
                    mediaKind: preparedMedia?.mediaKind || project.buffer.mediaKind,
                    mediaType: preparedMedia?.mediaType || project.buffer.mediaType,
                    fileName: preparedMedia?.fileName || project.buffer.fileName,
                    category: category.trim() || project.buffer.category
                  }
                : project.buffer
            }
          : project
      )
    }));
    setSuccess(nextStatus === "draft" ? "Draft updated." : "Scheduled locally.");
    setEditingQueueItemId("");
    return true;
  }

  function formatDuration(duration?: number) {
    if (!duration || Number.isNaN(duration)) return "0.0s";
    return `${duration.toFixed(1)}s`;
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
    if (editingQueueItemId) {
      const updated = saveQueueItemLocally(saveToDraft ? "draft" : scheduledAt ? "scheduled" : "queue");
      if (updated) return;
    }
    setPublishing(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/buffer/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          channels: selectedChannels().map((channel) => ({
            id: channel.id,
            service: channel.service,
            instagramTypes: channelSettings[channel.id]?.instagramTypes,
            youtubeCategory: channelSettings[channel.id]?.youtubeCategory || category.trim() || preparedMedia.category
          })),
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
        <div ref={editorSectionRef}>
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
              <div className="overflow-hidden rounded-md border border-[var(--panel-border)] bg-[#0d1116]">
                <div className="border-b border-[var(--panel-border)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">
                  Export preview
                </div>
                <div className="bg-black/60">
                  {preparedMedia.mediaKind === "video" ? (
                    <video src={preparedMedia.mediaUrl} controls autoPlay muted loop playsInline className="aspect-[9/16] w-full object-contain" />
                  ) : (
                    <img src={preparedMedia.mediaUrl} alt={preparedMedia.fileName || "Export preview"} className="aspect-[9/16] w-full object-contain" />
                  )}
                </div>
                <div className="space-y-2 px-3 py-3 text-xs text-[var(--text-dim)]">
                  <div>
                    Prepared media: <span className="text-[#e8e8e8]">{preparedMedia.mediaKind || "image"}</span> ·{" "}
                    <span className="text-[#e8e8e8]">{preparedMedia.fileName || "export"}</span>
                  </div>
                  {selectedHashtagGroup ? (
                    <div className="rounded-md border border-[var(--panel-border)] bg-[#11161d] px-2 py-1 text-[11px]">
                      <div className="uppercase tracking-[0.08em] text-[var(--text-dim)]">Hashtag group</div>
                      <div className="text-[#e8e8e8]">{selectedHashtagGroup.name}</div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedHashtagGroup.hashtags.map((tag) => (
                          <span key={tag} className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {tags.trim() ? (
                    <div className="text-[#e8e8e8]">
                      <div className="uppercase tracking-[0.08em] text-[var(--text-dim)]">Buffer tags</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tags
                          .split(/,|\n/)
                          .map((tag) => tag.trim())
                          .filter(Boolean)
                          .map((tag) => (
                            <span key={tag} className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[10px]">
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                  ) : null}
                  {pendingProject?.audioTracks?.length ? (
                    <div className="space-y-1">
                      <div className="uppercase tracking-[0.08em] text-[var(--text-dim)]">Audio used in export</div>
                      <div className="space-y-1">
                        {pendingProject.audioTracks.map((track) => (
                          <div key={track.id} className="rounded-md border border-[var(--panel-border)] bg-[#11161d] px-2 py-1 text-[11px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-[#e8e8e8]">{track.name}</span>
                              <span>{formatDuration(track.duration)}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-dim)]">
                              Starts at {formatDuration(track.start)} · Trim {formatDuration(track.trimStart)}–{formatDuration(track.trimEnd)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
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
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Hashtag group</span>
              <select
                className="w-full rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 outline-none"
                value={selectedHashtagGroupId}
                onChange={(event) => setSelectedHashtagGroupId(event.target.value)}
              >
                <option value="">Custom tags</option>
                {hashtagGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {group.hashtags.length} tags
                  </option>
                ))}
              </select>
            </label>
            <Textarea
              placeholder="Tags, comma separated"
              value={tags}
              onChange={(event) => {
                setSelectedHashtagGroupId("");
                setTags(event.target.value);
              }}
              className="min-h-24"
            />
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Audio reuse</span>
              <select
                className="w-full rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 outline-none"
                value={selectedAudioId}
                onChange={(event) => setSelectedAudioId(event.target.value)}
              >
                <option value="">Select saved audio</option>
                {audioAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {formatDuration(asset.duration)}
                  </option>
                ))}
              </select>
            </label>
            {selectedAudioAsset ? (
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-xs text-[var(--text-dim)]">
                Selected audio: <span className="text-[#e8e8e8]">{selectedAudioAsset.name}</span> · {formatDuration(selectedAudioAsset.duration)}
              </div>
            ) : null}
            {editingQueueItemId ? (
              <div className="rounded-md border border-[#3b4d66] bg-[#0f1722] px-3 py-2 text-xs text-[#d5e4f7]">
                Editing saved draft: {editingQueueItem?.title || "Buffer post"}. Use “Schedule Changes” to update the existing item instead of creating a duplicate.
              </div>
            ) : null}
            <Input placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            <div className="space-y-2 rounded-md border border-[var(--panel-border)] bg-[#0d1116] p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Channels</div>
              <div className="space-y-2">
                {bootstrap.channels.map((channel) => (
                  <div key={channel.id} className="rounded-md border border-[var(--panel-border)] bg-[#11161d] px-3 py-2 text-sm">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedChannelIds.includes(channel.id)} onChange={() => toggleChannel(channel.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{channel.displayName || channel.name}</span>
                        <span className="block text-xs text-[var(--text-dim)]">{channel.service}</span>
                      </span>
                      {channel.isQueuePaused ? <Badge className="bg-[#3a2626] text-[#ffb4b4]">Paused</Badge> : <Badge>Active</Badge>}
                    </label>
                    {selectedChannelIds.includes(channel.id) && channel.service.toLowerCase().includes("instagram") ? (
                      <div className="mt-3 space-y-2">
                        <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Instagram type</span>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {(["post", "story", "reel"] as const).map((instagramType) => {
                            const selectedTypes = channelSettings[channel.id]?.instagramTypes || defaultInstagramTypes(preparedMedia?.mediaKind);
                            const checked = selectedTypes.includes(instagramType);
                            return (
                              <label
                                key={instagramType}
                                className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                  checked
                                    ? "border-[#c9ad6d] bg-[#1a160f] text-[#f4e2b4]"
                                    : "border-[var(--panel-border)] bg-[#0d1116] text-[var(--text-dim)]"
                                }`}
                              >
                                <span>{instagramType.charAt(0).toUpperCase() + instagramType.slice(1)}</span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    setChannelSettings((current) => {
                                      const currentTypes = current[channel.id]?.instagramTypes || defaultInstagramTypes(preparedMedia?.mediaKind);
                                      const nextTypes = event.target.checked
                                        ? Array.from(new Set([...currentTypes, instagramType]))
                                        : currentTypes.filter((value) => value !== instagramType);
                                      return {
                                        ...current,
                                        [channel.id]: {
                                          ...current[channel.id],
                                          instagramTypes: nextTypes.length ? nextTypes : defaultInstagramTypes(preparedMedia?.mediaKind)
                                        }
                                      };
                                    })
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {selectedChannelIds.includes(channel.id) && channel.service.toLowerCase().includes("youtube") ? (
                      <label className="mt-3 block space-y-2">
                        <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">YouTube category</span>
                        <Input
                          placeholder="People & Blogs"
                          value={channelSettings[channel.id]?.youtubeCategory || category}
                          onChange={(event) =>
                            setChannelSettings((current) => ({
                              ...current,
                              [channel.id]: { ...current[channel.id], youtubeCategory: event.target.value }
                            }))
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                ))}
                {!bootstrap.channels.length && !loading ? <div className="text-sm text-[var(--text-dim)]">No channels loaded.</div> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => publishToBuffer(false)} disabled={publishing || !bootstrap.configured}>
                {publishing ? "Loading..." : editingQueueItemId ? "Schedule Changes" : "Queue Post"}
              </Button>
              <Button variant="secondary" onClick={() => publishToBuffer(true)} disabled={publishing || !bootstrap.configured}>
                {editingQueueItemId ? "Update Draft" : "Queue Draft"}
              </Button>
              {editingQueueItemId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingQueueItemId("");
                    setTitle("");
                    setCaption("");
                    setTags("");
                    setScheduledAt("");
                  }}
                  disabled={publishing}
                >
                  Cancel Edit
                </Button>
              ) : null}
            </div>
            <div className="text-xs text-[var(--text-dim)]">
              Optional fields: title, category, tags, schedule time. Buffer keeps the selected channels as separate queued posts.
            </div>
          </CardContent>
          </Card>
        </div>

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
                <div className="mt-1 text-lg font-semibold">{queueByStatus.draft.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Queue</div>
                <div className="mt-1 text-lg font-semibold">{queueByStatus.queue.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Scheduled</div>
                <div className="mt-1 text-lg font-semibold">{queueByStatus.scheduled.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Published</div>
                <div className="mt-1 text-lg font-semibold">{queueByStatus.published.length}</div>
              </div>
              <div className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Failed</div>
                <div className="mt-1 text-lg font-semibold">{queueByStatus.failed.length}</div>
              </div>
            </div>
            {!ready || loading ? <div className="text-sm text-[var(--text-dim)]">Loading Buffer data…</div> : null}
            {queueByStatus.draft.length ? (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Drafts</div>
                <div className="space-y-3">
                  {queueByStatus.draft.map((item) => (
                    <div key={item.id} className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-[var(--text-dim)]">{queueItemSummary(item)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{formatBufferStatus(item.status)}</Badge>
                          <Badge className="border-[var(--panel-border)] bg-[#11161d] text-[#e8e8e8]">{queueItemLabel(item)}</Badge>
                          <Badge className="border-[var(--panel-border)] bg-[#11161d] text-[#e8e8e8]">
                            {queueItemMediaLabel(item)}
                          </Badge>
                          <Badge className="border-[var(--panel-border)] bg-[#11161d] text-[#e8e8e8]">
                            Upload · {queueItemUploadLabel(item)}
                          </Badge>
                        </div>
                      </div>
                      {item.caption ? <div className="mt-2 line-clamp-2 text-xs text-[var(--text-dim)]">{item.caption}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openQueueItemEditor(item, "edit")}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openQueueItemEditor(item, "schedule")}
                        >
                          Schedule
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
                <div className="space-y-3">
                  {queuedItems.filter((item) => item.status !== "draft").map((item) => (
                    <div key={item.id} className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-[var(--text-dim)]">{queueItemSummary(item)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{formatBufferStatus(item.status)}</Badge>
                          <Badge className="border-[var(--panel-border)] bg-[#11161d] text-[#e8e8e8]">{queueItemLabel(item)}</Badge>
                          <Badge className="border-[var(--panel-border)] bg-[#11161d] text-[#e8e8e8]">{queueItemMediaLabel(item)}</Badge>
                          <Badge className="border-[var(--panel-border)] bg-[#11161d] text-[#e8e8e8]">
                            Upload · {queueItemUploadLabel(item)}
                          </Badge>
                        </div>
                      </div>
                      {item.caption ? <div className="mt-2 line-clamp-2 text-xs text-[var(--text-dim)]">{item.caption}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openQueueItemEditor(item, "edit")}>
                          Edit
                        </Button>
                        {item.status !== "published" ? (
                          <Button size="sm" variant="secondary" onClick={() => openQueueItemEditor(item, "schedule")}>
                            {item.status === "scheduled" ? "Reschedule" : "Schedule"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
              {!queuedItems.length && !loading ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[#0d1116] px-4 py-8 text-sm text-[var(--text-dim)]">
                  No Buffer queue items saved yet.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteShell>
  );
}
