const DB_NAME = "hadith-media-store";
const STORE_NAME = "media";
const DB_VERSION = 1;

type StoredMedia = {
  id: string;
  source: string;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open media store."));
  });
}

export async function saveMediaSource(source: string) {
  const id = `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id, source } satisfies StoredMedia);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not save media source."));
  });
  db.close();
  return id;
}

export async function getMediaSource(id: string) {
  if (/^https?:\/\//i.test(id) || id.startsWith("data:")) return id;
  const db = await openDb();
  const source = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as StoredMedia | undefined)?.source || null);
    request.onerror = () => reject(request.error || new Error("Could not load media source."));
  });
  db.close();
  return source;
}

export async function deleteMediaSource(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not delete media source."));
  });
  db.close();
}
