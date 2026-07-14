"use client";

import { useEffect, useState } from "react";
import { createInitialDb, fetchStudioDb, readLocalDb, readLocalDbSnapshot, writeLocalDb } from "@/lib/persistence";
import type { StudioDatabase } from "@/types/studio";

export function useStudioDb() {
  const [db, setDb] = useState<StudioDatabase>(createInitialDb());
  const [ready, setReady] = useState(false);
  const [storageMode, setStorageMode] = useState<"server" | "local">("server");

  useEffect(() => {
    let active = true;
    async function loadDb() {
      const serverResponse = await fetchStudioDb();
      if (!active) return;
      if (serverResponse?.configured && serverResponse.connected) {
        if (serverResponse.hasDocument) {
          setDb(serverResponse.db);
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
      writeLocalDb(db);
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
