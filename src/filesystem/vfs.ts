import type { FileNode } from "./types";

const DEFAULT_FILES: FileNode[] = [
  {
    path: "/package.json",
    type: "file",
    content: JSON.stringify(
      {
        name: "sample-project",
        version: "1.0.0",
        private: true,
        scripts: {
          start: "node index.js",
        },
      },
      null,
      2,
    ),
  },
  {
    path: "/index.js",
    type: "file",
    content: "console.log('AlmostNode workspace ready');\n",
  },
];

export class VirtualFileSystem {
  private readonly files = new Map<string, string>();

  constructor(seed: FileNode[] = DEFAULT_FILES) {
    for (const file of seed) {
      if (file.type === "file") {
        this.files.set(file.path, file.content ?? "");
      }
    }
  }

  listFiles(): FileNode[] {
    return [...this.files.entries()].map(([path, content]) => ({
      path,
      type: "file",
      content,
    }));
  }

  readFile(path: string): string {
    return this.files.get(path) ?? "";
  }

  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  deleteFile(path: string): void {
    this.files.delete(path);
  }
}

export function createDefaultVfs(): VirtualFileSystem {
  return new VirtualFileSystem();
}
