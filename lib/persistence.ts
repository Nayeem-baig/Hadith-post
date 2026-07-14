import type { AppSettings, AssetRecord, BufferAccount, BufferQueueItem, HadithProject, HashtagGroup, StudioDatabase } from "@/types/studio";

const STORAGE_KEY = "hadith-studio-db";
const STUDIO_API = "/api/studio";

export function defaultSettings(): AppSettings {
  return {
    creator: {
      watermarkText: "",
      watermarkOpacity: 0.42,
      watermarkFont: "Jost",
      watermarkSize: 28,
      watermarkPosition: "bottom-right",
      creatorName: "Nayeem"
    },
    bufferEnabled: false,
    theme: "dark"
  };
}

export function createInitialDb(): StudioDatabase {
  return {
    projects: [],
    assets: [],
    hashtags: [
      { id: "general", name: "General", hashtags: ["#Islam", "#Hadith", "#Muslim"], favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ramadan", name: "Ramadan", hashtags: ["#Ramadan", "#IslamicReminder"], favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    bufferQueue: [],
    bufferAccounts: [],
    favorites: { projectIds: [], assetIds: [], hashtagIds: [] },
    settings: defaultSettings()
  };
}

export function normalizeStudioDb(db: Partial<StudioDatabase> | null | undefined): StudioDatabase {
  if (!db) return createInitialDb();
  return {
    ...createInitialDb(),
    ...db,
    settings: { ...defaultSettings(), ...(db.settings || {}) },
    favorites: { projectIds: [], assetIds: [], hashtagIds: [], ...(db.favorites || {}) }
  };
}

export function readLocalDb(): StudioDatabase {
  return readLocalDbSnapshot().db;
}

export function readLocalDbSnapshot(): { db: StudioDatabase; hasData: boolean } {
  if (typeof window === "undefined") return { db: createInitialDb(), hasData: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { db: createInitialDb(), hasData: false };
    const parsed = JSON.parse(raw) as Partial<StudioDatabase>;
    return { db: normalizeStudioDb(parsed), hasData: true };
  } catch {
    return { db: createInitialDb(), hasData: false };
  }
}

export function writeLocalDb(db: StudioDatabase) {
  if (typeof window === "undefined") return;
  void (async () => {
    const response = await fetch(STUDIO_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ db }),
      keepalive: true
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; configured?: boolean; error?: string } | null;
    if (!response.ok || payload?.ok === false || payload?.configured === false) {
      throw new Error(payload?.error || (await response.text()));
    }
  })().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!/SSL routines|tlsv1 alert internal error|MongoServerSelectionError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Server selection timed out|bad auth|AuthenticationFailed/i.test(message)) {
      console.error("Studio sync failed:", error);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (storageError) {
      console.error("Studio local fallback failed:", storageError);
    }
  });
}

export async function fetchStudioDb(): Promise<{ configured: boolean; connected: boolean; hasDocument: boolean; db: StudioDatabase } | null> {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch(STUDIO_API, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as { configured?: boolean; connected?: boolean; hasDocument?: boolean; db?: Partial<StudioDatabase> };
    return {
      configured: Boolean(payload.configured),
      connected: Boolean(payload.connected),
      hasDocument: Boolean(payload.hasDocument),
      db: normalizeStudioDb(payload.db)
    };
  } catch (error) {
    console.error("Studio fetch failed:", error);
    return null;
  }
}

export function upsertProject(db: StudioDatabase, project: HadithProject): StudioDatabase {
  const nextProjects = [...db.projects];
  const index = nextProjects.findIndex((item) => item.id === project.id);
  if (index >= 0) nextProjects[index] = project;
  else nextProjects.unshift(project);
  return { ...db, projects: nextProjects };
}

export function upsertAsset(db: StudioDatabase, asset: AssetRecord): StudioDatabase {
  const nextAssets = [...db.assets];
  const index = nextAssets.findIndex((item) => item.id === asset.id);
  if (index >= 0) nextAssets[index] = asset;
  else nextAssets.unshift(asset);
  return { ...db, assets: nextAssets };
}

export function upsertHashtagGroup(db: StudioDatabase, group: HashtagGroup): StudioDatabase {
  const nextGroups = [...db.hashtags];
  const index = nextGroups.findIndex((item) => item.id === group.id);
  if (index >= 0) nextGroups[index] = group;
  else nextGroups.unshift(group);
  return { ...db, hashtags: nextGroups };
}

export function queueBufferPost(db: StudioDatabase, item: BufferQueueItem): StudioDatabase {
  return { ...db, bufferQueue: [item, ...db.bufferQueue] };
}
