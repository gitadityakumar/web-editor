import type { FileNode } from "../filesystem/types";

const STORE_KEY = "almostnode.workspace.v1";
const SNAPSHOT_KEY = "almostnode.workspace.snapshots.v1";
const DB_NAME = "almostnode-workspace";
const DB_VERSION = 1;
const KV_STORE = "kv";
const MAX_SNAPSHOTS = 10;

interface SnapshotEntry {
  timestamp: number;
  files: FileNode[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

  return dbPromise;
}

async function dbGet(key: string): Promise<string | null> {
  try {
    const db = await openDb();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(KV_STORE, "readonly");
      const store = tx.objectStore(KV_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB get failed."));
    });
  } catch {
    return null;
  }
}

async function dbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KV_STORE, "readwrite");
      const store = tx.objectStore(KV_STORE);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB put failed."));
    });
  } catch {
    // Keep localStorage fallback as safety if IndexedDB is unavailable.
  }
}

function parseFiles(raw: string | null): FileNode[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as FileNode[];
  } catch {
    return null;
  }
}

function parseSnapshots(raw: string | null): SnapshotEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is SnapshotEntry => {
      return (
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SnapshotEntry).timestamp === "number" &&
        Array.isArray((entry as SnapshotEntry).files)
      );
    });
  } catch {
    return [];
  }
}

function saveSnapshotsLocal(snapshots: SnapshotEntry[]): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}

async function loadSnapshots(): Promise<SnapshotEntry[]> {
  const idbValue = await dbGet(SNAPSHOT_KEY);
  const parsed = parseSnapshots(idbValue);
  if (parsed.length > 0) {
    return parsed;
  }

  return parseSnapshots(localStorage.getItem(SNAPSHOT_KEY));
}

async function saveSnapshots(snapshots: SnapshotEntry[]): Promise<void> {
  const serialized = JSON.stringify(snapshots);
  saveSnapshotsLocal(snapshots);
  await dbSet(SNAPSHOT_KEY, serialized);
}

export async function saveWorkspace(files: FileNode[]): Promise<void> {
  const serialized = JSON.stringify(files);
  localStorage.setItem(STORE_KEY, serialized);
  await dbSet(STORE_KEY, serialized);

  const snapshots = await loadSnapshots();
  const latest = snapshots[snapshots.length - 1];
  const latestSerialized = latest ? JSON.stringify(latest.files) : "";

  if (serialized === latestSerialized) {
    return;
  }

  const nextSnapshots = [
    ...snapshots,
    {
      timestamp: Date.now(),
      files,
    },
  ].slice(-MAX_SNAPSHOTS);

  await saveSnapshots(nextSnapshots);
}

export async function loadWorkspace(): Promise<FileNode[] | null> {
  const idbDirect = parseFiles(await dbGet(STORE_KEY));
  if (idbDirect) {
    return idbDirect;
  }

  const localDirect = parseFiles(localStorage.getItem(STORE_KEY));
  if (localDirect) {
    return localDirect;
  }

  const snapshots = await loadSnapshots();
  const lastValid = snapshots[snapshots.length - 1];

  return lastValid?.files ?? null;
}

export async function loadPreviousWorkspaceSnapshot(): Promise<FileNode[] | null> {
  const snapshots = await loadSnapshots();
  if (snapshots.length < 2) {
    return null;
  }

  return snapshots[snapshots.length - 2].files;
}
