import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { StoredClip } from "@/lib/media/types";

/**
 * Uploaded clips live in IndexedDB, never on a server. The bytes stay on the
 * machine that uploaded them and survive reloads without a round trip.
 */

const DB_NAME = "peripheral";
const DB_VERSION = 1;
const STORE = "clips";

interface PeripheralDB extends DBSchema {
  [STORE]: {
    key: string;
    value: StoredClip;
    indexes: { addedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<PeripheralDB>> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  }
  dbPromise ??= openDB<PeripheralDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("addedAt", "addedAt");
    },
  });
  return dbPromise;
}

export async function listStoredClips(): Promise<StoredClip[]> {
  const db = await getDb();
  const clips = await db.getAllFromIndex(STORE, "addedAt");
  return clips.reverse();
}

export async function saveStoredClip(clip: StoredClip) {
  const db = await getDb();
  await db.put(STORE, clip);
}

export async function deleteStoredClip(id: string) {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function clearStoredClips() {
  const db = await getDb();
  await db.clear(STORE);
}
