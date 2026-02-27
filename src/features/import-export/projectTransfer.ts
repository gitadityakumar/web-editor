import type { FileNode } from "../../filesystem/types";
import JSZip from "jszip";

export function exportProject(files: FileNode[]): string {
  return JSON.stringify(files, null, 2);
}

export function importProject(serialized: string): FileNode[] {
  return JSON.parse(serialized) as FileNode[];
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
  return /^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?\/?$/.test(url.trim());
}
