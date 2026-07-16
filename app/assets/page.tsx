"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RouteShell } from "@/components/studio/RouteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStudioDb } from "@/hooks/use-studio-db";
import { uploadBlobToCloudinary } from "@/lib/cloudinary-upload";
import { upsertAsset } from "@/lib/persistence";
import type { AssetRecord, AssetKind } from "@/types/studio";

async function audioDurationFromSource(sourceUrl: string) {
  return await new Promise<number>((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
    audio.src = sourceUrl;
  });
}

export default function AssetsPage() {
  const router = useRouter();
  const { db, setDb, ready } = useStudioDb();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<AssetKind>("background");
  const [uploading, setUploading] = useState(false);

  const assets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return db.assets.filter((asset) => {
      if (kind && asset.kind !== kind) return false;
      if (!term) return true;
      return [asset.name, asset.kind, asset.storagePath || ""].some((field) => field.toLowerCase().includes(term));
    });
  }, [db.assets, kind, search]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: AssetRecord[] = [];
      for (const file of files) {
        const isAudio = file.type.startsWith("audio");
        const isVideo = file.type.startsWith("video");
        const isImage = file.type.startsWith("image");
        if (kind === "audio" && !isAudio) throw new Error("Audio assets must be audio files.");
        if ((kind === "background" || kind === "template") && !isImage && !isVideo) throw new Error("Backgrounds and templates must be images or videos.");
        const resourceType = isVideo ? "video" : isImage ? "image" : "auto";
        const uploadedUrl = await uploadBlobToCloudinary({
          blob: file,
          path: `assets/${kind}/${Date.now()}-${file.name}`,
          contentType: file.type || "application/octet-stream",
          fileName: file.name,
          resourceType
        });
        const sourceUrl = uploadedUrl;
        const duration = isAudio ? await audioDurationFromSource(sourceUrl) : undefined;
        uploaded.push({
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          kind,
          sourceUrl,
          storagePath: sourceUrl,
          fileSize: file.size,
          duration,
          favorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mediaKind: isAudio ? "audio" : isVideo ? "video" : "image",
          metadata: { type: file.type, uploadedBy: "cloudinary" }
        });
      }
      setDb((current) => uploaded.reduce((state, asset) => upsertAsset(state, asset), current));
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Try another file or check browser permissions.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function toggleFavorite(id: string) {
    setDb((current) => ({
      ...current,
      assets: current.assets.map((asset) => (asset.id === id ? { ...asset, favorite: !asset.favorite, updatedAt: new Date().toISOString() } : asset))
    }));
  }

  function deleteAsset(id: string) {
    setDb((current) => ({ ...current, assets: current.assets.filter((asset) => asset.id !== id) }));
  }

  function reuseAsset(asset: AssetRecord) {
    if (asset.kind === "background" || asset.kind === "template") {
      window.localStorage.setItem("hadith-studio-pending-background", asset.sourceUrl);
      window.localStorage.setItem("hadith-studio-pending-background-name", asset.name);
      window.localStorage.setItem("hadith-studio-pending-background-kind", asset.mediaKind === "video" || asset.metadata.type?.toString().startsWith("video/") ? "video" : "image");
    } else {
      window.localStorage.setItem("hadith-studio-pending-audio", asset.sourceUrl);
      window.localStorage.setItem("hadith-studio-pending-audio-name", asset.name);
    }
    router.push("/");
  }

  return (
    <RouteShell title="Asset Library" description="Backgrounds, templates, and audio uploads stored in Cloudinary and reused everywhere.">
      <Card className="border-[var(--panel-border)] bg-[#11161d]">
        <CardHeader>
          <CardTitle className="text-[var(--gold-soft)]">Uploads</CardTitle>
          <CardDescription>Preview, favorite, delete, and reuse uploaded files.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
              <span className="mb-2 block text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Kind</span>
              <select className="w-full bg-transparent outline-none" value={kind} onChange={(event) => setKind(event.target.value as AssetKind)}>
                <option value="background">Backgrounds</option>
                <option value="template">Templates</option>
                <option value="audio">Audio</option>
              </select>
            </label>
            <label className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm md:col-span-2">
              <span className="mb-2 block text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Upload files</span>
              <Input type="file" accept="image/*,video/*,audio/*" multiple onChange={handleUpload} disabled={uploading} className="border-none bg-transparent p-0" />
            </label>
            <label className="rounded-md border border-[var(--panel-border)] bg-[#0d1116] px-3 py-2 text-sm">
              <span className="mb-2 block text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Search</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" />
            </label>
          </div>
          {!ready ? <div className="text-sm text-[var(--text-dim)]">Loading assets…</div> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <Card key={asset.id} className="border-[var(--panel-border)] bg-[#0d1116]">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{asset.name}</CardTitle>
                      <CardDescription className="text-xs">{asset.kind}</CardDescription>
                    </div>
                    <Badge>{asset.favorite ? "Favorite" : "Asset"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--text-dim)]">
                    <span>{asset.fileSize ? `${Math.round(asset.fileSize / 1024)} KB` : "Unknown size"}</span>
                    {asset.duration ? <span>{asset.duration.toFixed(1)}s</span> : null}
                    <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-hidden rounded-md border border-[var(--panel-border)] bg-black/40">
                    {asset.kind === "audio" ? (
                      <audio controls className="w-full" src={asset.sourceUrl} />
                    ) : (
                      asset.mediaKind === "video" || asset.metadata.type?.toString().startsWith("video/") ? (
                        <video src={asset.sourceUrl} controls className="h-48 w-full object-cover" />
                      ) : (
                        <img src={asset.sourceUrl} alt={asset.name} className="h-48 w-full object-cover" />
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => reuseAsset(asset)}>Reuse</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleFavorite(asset.id)}>{asset.favorite ? "★ Unfavorite" : "★ Favorite"}</Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteAsset(asset.id)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {!assets.length ? <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[#0d1116] px-4 py-8 text-sm text-[var(--text-dim)]">No assets in this category yet.</div> : null}
        </CardContent>
      </Card>
    </RouteShell>
  );
}
