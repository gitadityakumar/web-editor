import type { FileNode } from "../../filesystem/types";
import JSZip from "jszip";

export function exportProject(files: FileNode[]): string {
  return JSON.stringify(files, null, 2);
}

export function importProject(serialized: string): FileNode[] {
  const parsed = JSON.parse(serialized) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid import format. Expected an array of files.");
  }

  const normalized: FileNode[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const entry = item as Partial<FileNode>;
    if (entry.type !== "file" || typeof entry.path !== "string") {
      continue;
    }

    const cleanPath = sanitizePath(entry.path);
    if (!cleanPath) {
      continue;
    }

    normalized.push({
      path: cleanPath,
      type: "file",
      content: typeof entry.content === "string" ? entry.content : "",
    });
  }

  if (normalized.length === 0) {
    throw new Error("No valid files found in imported payload.");
  }

  return normalized;
}

export async function exportProjectZip(files: FileNode[], projectName: string): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    if (file.type !== "file") {
      continue;
    }

    const zipPath = file.path.replace(/^\//, "");
    zip.file(zipPath, file.content ?? "");
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    comment: `${projectName} export`,
  });
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function isGitHubRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeGitHubUrl(url));
    if (parsed.hostname !== "github.com") {
      return false;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeGitHubUrl(url: string): string {
  const value = url.trim();
  if (value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("http://")) {
    return `https://${value.slice("http://".length)}`;
  }

  return `https://${value}`;
}

function sanitizePath(raw: string): string | null {
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  if (normalized.includes("..")) {
    return null;
  }

  return normalized;
}
