import type { FileNode } from "../filesystem/types";

const STORE_KEY = "almostnode.workspace.v1";

export function saveWorkspace(files: FileNode[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(files));
}

export function loadWorkspace(): FileNode[] | null {
  const raw = localStorage.getItem(STORE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FileNode[];
  } catch {
    return null;
  }
}
