import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createInitialDb, normalizeStudioDb } from "@/lib/persistence";
import { verifySessionToken } from "@/lib/auth";
import type { StudioDatabase } from "@/types/studio";
import { studioDocumentId } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "studio_state";
async function getUsername(request: NextRequest) {
  const token = request.cookies.get("hadith_session")?.value;
  return await verifySessionToken(token);
}

async function readStudioDocument(username: string): Promise<{ db: StudioDatabase | null; hasDocument: boolean; connected: boolean }> {
  try {
    const db = await getDb();
    const collection = db.collection<{ _id: string; db?: unknown }>(COLLECTION);
    const document = await collection.findOne<{ db?: unknown }>({ _id: studioDocumentId(username) });
    return {
      db: document ? normalizeStudioDb(document.db as Partial<StudioDatabase>) : null,
      hasDocument: Boolean(document),
      connected: true
    };
  } catch (error) {
    console.error("Mongo studio load failed:", error);
    return { db: null, hasDocument: false, connected: false };
  }
}

export async function GET(request: NextRequest) {
  const username = await getUsername(request);
  if (!username) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const configured = Boolean(process.env.MONGO_USER && process.env.MONGO_PASSWORD);
  const stored = configured ? await readStudioDocument(username) : { db: null, hasDocument: false, connected: false };
  const db = stored.db || createInitialDb();
  return NextResponse.json({ configured, connected: stored.connected, hasDocument: stored.hasDocument, db, username });
}

export async function PUT(request: NextRequest) {
  let payload: { db?: unknown } | null = null;
  try {
    payload = (await request.json()) as { db?: unknown };
  } catch {
    payload = null;
  }
  const username = await getUsername(request);
  if (!username) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const db = normalizeStudioDb(payload?.db as Partial<StudioDatabase>);
  try {
    const mongo = await getDb();
    const collection = mongo.collection<{ _id: string; db?: unknown }>(COLLECTION);
    await collection.updateOne(
      { _id: studioDocumentId(username) },
      {
        $set: {
          db,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, db, username });
  } catch (error) {
    console.error("Mongo studio save failed:", error);
    return NextResponse.json({
      ok: false,
      configured: Boolean(process.env.MONGO_USER && process.env.MONGO_PASSWORD),
      error: error instanceof Error ? error.message : "MongoDB save failed."
    });
  }
}
