import { NextRequest, NextResponse } from "next/server";
import { createBufferPost } from "@/lib/buffer";
import { getDb } from "@/lib/mongodb";
import { verifySessionToken } from "@/lib/auth";
import { normalizeStudioDb } from "@/lib/persistence";
import type { BufferPostRecord, BufferQueueItem, StudioDatabase } from "@/types/studio";
import { studioDocumentId } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = {
  organizationId: string;
  channels: Array<{
    id: string;
    service: string;
    instagramTypes?: Array<"post" | "story" | "reel">;
    youtubeCategory?: string;
  }>;
  caption?: string;
  title?: string;
  scheduledAt?: string;
  tags?: string[];
  saveToDraft?: boolean;
  projectId?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "video";
  mediaType?: string;
  fileName?: string;
  category?: string;
};

const YOUTUBE_CATEGORY_IDS: Record<string, string> = {
  "Film & Animation": "1",
  "Autos & Vehicles": "2",
  Music: "10",
  "Pets & Animals": "15",
  Sports: "17",
  "Travel & Events": "19",
  Gaming: "20",
  "People & Blogs": "22",
  Comedy: "23",
  Entertainment: "24",
  "News & Politics": "25",
  "Howto & Style": "26",
  Education: "27",
  "Science & Technology": "28",
  "Nonprofits & Activism": "29"
};

function resolveYoutubeCategoryId(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return trimmed;
  return YOUTUBE_CATEGORY_IDS[trimmed] || undefined;
}

async function getUsername(request: NextRequest) {
  const token = request.cookies.get("hadith_session")?.value;
  return await verifySessionToken(token);
}

async function mirrorQueueToMongo(username: string, items: BufferQueueItem[]) {
  try {
    const mongo = await getDb();
    const collection = mongo.collection<{ _id: string; db?: unknown }>("studio_state");
    const current = await collection.findOne<{ db?: unknown }>({ _id: studioDocumentId(username) });
    const db = normalizeStudioDb(current?.db as Partial<StudioDatabase>);
    const nextQueue = [...items, ...db.bufferQueue.filter((existing) => !items.some((item) => item.id === existing.id))];
    await collection.updateOne(
      { _id: studioDocumentId(username) },
      {
        $set: {
          db: {
            ...db,
            bufferQueue: nextQueue
          },
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Buffer queue mirror failed:", error);
  }
}

export async function POST(request: NextRequest) {
  let body: PublishBody | null = null;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    body = null;
  }
  const username = await getUsername(request);
  if (!username) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!body?.organizationId || !body.channels?.length) {
    return NextResponse.json({ ok: false, error: "Select at least one channel." }, { status: 400 });
  }
  const text = [body.title?.trim(), body.caption?.trim()].filter(Boolean).join("\n\n").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Caption or title is required." }, { status: 400 });
  }
  if (!body.mediaUrl) {
    return NextResponse.json({ ok: false, error: "Export media is missing. Use Post to Buffer from the editor first." }, { status: 400 });
  }

  try {
    const createdPosts: BufferPostRecord[] = [];
    const createdDrafts: BufferPostRecord[] = [];
    for (const channel of body.channels) {
      const isYoutube = channel.service.toLowerCase().includes("youtube");
      const isInstagram = channel.service.toLowerCase().includes("instagram");
      if (isYoutube && body.mediaKind !== "video") {
        return NextResponse.json({ ok: false, error: "YouTube requires a video export. Switch the hadith to video before posting." }, { status: 400 });
      }
      const mediaTitle = body.title?.trim() || body.caption?.trim() || body.fileName?.replace(/\.[^.]+$/, "") || "Buffer post";
      const assets =
        body.mediaKind === "video"
          ? [
              {
                video: {
                  url: body.mediaUrl,
                  metadata: {
                    thumbnailOffset: 2000
                  }
                }
              }
          ]
          : [{ image: { url: body.mediaUrl } }];
      if (isInstagram) {
        const instagramTypes: Array<"post" | "story" | "reel"> = channel.instagramTypes?.length
          ? channel.instagramTypes
          : [body.mediaKind === "video" ? "reel" : "post"];
        for (const instagramType of instagramTypes) {
          const result = await createBufferPost({
            organizationId: body.organizationId,
            channelId: channel.id,
            text,
            scheduledAt: body.scheduledAt,
            saveToDraft: body.saveToDraft,
            assets,
            metadata: {
              instagram: {
                type: instagramType,
                shouldShareToFeed: instagramType !== "story"
              }
            }
          });
          if ("message" in result) {
            throw new Error(result.message);
          }
          if (body.saveToDraft) {
            createdDrafts.push(result.post);
          } else {
            createdPosts.push(result.post);
          }
        }
        continue;
      }
      const metadata = isYoutube
        ? {
            youtube: {
              title: mediaTitle,
              categoryId: resolveYoutubeCategoryId(body.category) || "22"
            }
          }
        : undefined;
      const result = await createBufferPost({
        organizationId: body.organizationId,
        channelId: channel.id,
        text,
        scheduledAt: body.scheduledAt,
        saveToDraft: body.saveToDraft,
        assets,
        metadata
      });
      if ("message" in result) {
        throw new Error(result.message);
      }
      if (body.saveToDraft) {
        createdDrafts.push(result.post);
      } else {
        createdPosts.push(result.post);
      }
    }

    if (body.saveToDraft) {
      const draftItems: BufferQueueItem[] = createdDrafts.map((post) => ({
        id: post.id,
        projectId: body.projectId,
        title: body.title || post.text.slice(0, 80) || "Buffer draft",
        status: "draft",
        scheduledAt: post.dueAt,
        accountIds: [post.channelId],
        caption: body.caption,
        tags: body.tags
      }));
      await mirrorQueueToMongo(username, draftItems);
      return NextResponse.json({ ok: true, drafts: createdDrafts });
    }

    const queueItems: BufferQueueItem[] = createdPosts.map((post) => ({
      id: post.id,
      projectId: body.projectId,
      title: body.title || post.text.slice(0, 80) || "Buffer post",
      status: (post.status as BufferQueueItem["status"]) || (body.scheduledAt ? "scheduled" : "queue"),
      scheduledAt: post.dueAt || body.scheduledAt,
      accountIds: [post.channelId],
      caption: body.caption,
      tags: body.tags
    }));
    await mirrorQueueToMongo(username, queueItems);
    return NextResponse.json({ ok: true, posts: createdPosts });
  } catch (error) {
    console.error("Buffer publish failed:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Buffer publish failed."
    }, { status: 500 });
  }
}
