import type { FileNode } from "../filesystem/types";

const STORE_KEY = "almostnode.workspace.v1";
const SNAPSHOT_KEY = "almostnode.workspace.snapshots.v1";
const MAX_SNAPSHOTS = 10;

interface SnapshotEntry {
  timestamp: number;
  files: FileNode[];
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

function loadSnapshots(): SnapshotEntry[] {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
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

function saveSnapshots(snapshots: SnapshotEntry[]): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}

export function saveWorkspace(files: FileNode[]): void {
  const serialized = JSON.stringify(files);
  localStorage.setItem(STORE_KEY, serialized);

  const snapshots = loadSnapshots();
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

  saveSnapshots(nextSnapshots);
}

export function loadWorkspace(): FileNode[] | null {
  const direct = parseFiles(localStorage.getItem(STORE_KEY));
  if (direct) {
    return direct;
  }

  const snapshots = loadSnapshots();
  const lastValid = snapshots[snapshots.length - 1];

  return lastValid?.files ?? null;
}

export function loadPreviousWorkspaceSnapshot(): FileNode[] | null {
  const snapshots = loadSnapshots();
  if (snapshots.length < 2) {
    return null;
  }

  return snapshots[snapshots.length - 2].files;
}
