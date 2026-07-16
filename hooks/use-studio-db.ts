"use client";

import { useEffect, useRef, useState } from "react";
import { createInitialDb, fetchStudioDb, mergeStudioDb, readLocalDb, readLocalDbSnapshot, writeLocalDb } from "@/lib/persistence";
import type { StudioDatabase } from "@/types/studio";

export function useStudioDb() {
  const [db, setDb] = useState<StudioDatabase>(createInitialDb());
  const [ready, setReady] = useState(false);
  const [storageMode, setStorageMode] = useState<"server" | "local">("server");
  const syncTimerRef = useRef<number | null>(null);
  const lastSyncedSnapshotRef = useRef("");
  const syncRevisionRef = useRef(0);

  useEffect(() => {
    let active = true;
    async function loadDb() {
      const serverResponse = await fetchStudioDb();
      if (!active) return;
      if (serverResponse?.configured && serverResponse.connected) {
        if (serverResponse.hasDocument) {
          const localSnapshot = readLocalDbSnapshot();
          setDb(localSnapshot.hasData ? mergeStudioDb(serverResponse.db, localSnapshot.db) : serverResponse.db);
        } else {
          const localSnapshot = readLocalDbSnapshot();
          setDb(localSnapshot.hasData ? localSnapshot.db : serverResponse.db);
        }
        setStorageMode("server");
      } else {
        setDb(readLocalDb());
        setStorageMode("local");
      }
      setReady(true);
    }
    void loadDb();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (storageMode === "server") {
      const snapshot = JSON.stringify(db);
      if (snapshot === lastSyncedSnapshotRef.current) return;
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      const revision = ++syncRevisionRef.current;
      syncTimerRef.current = window.setTimeout(() => {
        if (syncRevisionRef.current !== revision) return;
        lastSyncedSnapshotRef.current = snapshot;
        writeLocalDb(db);
      }, 750);
      return;
    }
    try {
      window.localStorage.setItem("hadith-studio-db", JSON.stringify(db));
    } catch (error) {
      console.error("Local studio fallback failed:", error);
    }
  }, [db, ready, storageMode]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (storageMode !== "server" || typeof navigator === "undefined" || !navigator.sendBeacon) return;
      try {
        if (syncTimerRef.current) {
          window.clearTimeout(syncTimerRef.current);
        }
        lastSyncedSnapshotRef.current = JSON.stringify(db);
        navigator.sendBeacon(
          "/api/studio",
          new Blob([JSON.stringify({ db })], {
            type: "application/json"
          })
        );
      } catch (error) {
        console.error("Studio unload sync failed:", error);
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [db, storageMode]);

  return { db, setDb, ready };
}
