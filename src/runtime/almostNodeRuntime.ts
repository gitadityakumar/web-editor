import type { FileNode } from "../filesystem/types";

export interface RuntimeCommandResult {
  ok: boolean;
  output: string;
}

export class AlmostNodeRuntime {
  private container: any | null = null;
  private running = false;

  async boot(): Promise<void> {
    if (this.container) {
      this.running = true;
      return;
    }

    const { createContainer } = await import("almostnode");
    this.container = await createContainer();
    this.running = true;
  }

  async shutdown(): Promise<void> {
    if (
      this.container &&
      typeof (this.container as { destroy?: () => Promise<void> }).destroy === "function"
    ) {
      await (this.container as { destroy: () => Promise<void> }).destroy();
    }

    this.container = null;
    this.running = false;
  }

  async syncFiles(files: FileNode[]): Promise<void> {
    await this.boot();

    for (const file of files) {
      if (file.type !== "file") {
        continue;
      }

      await this.container!.fs.writeFile(file.path, file.content ?? "");
    }
  }

  async exec(command: string): Promise<RuntimeCommandResult> {
    if (!this.running) {
      return {
        ok: false,
        output: "Runtime is not booted.",
      };
    }

    const [bin, ...args] = command.split(" ");
    const process = await this.container!.runCommand(bin, args);
    const output = await process.output;

    return {
      ok: true,
      output: output || `[almostnode] command finished: ${command}`,
    };
  }

  async importFromGitHubUrl(repoUrl: string): Promise<FileNode[]> {
    const parsed = new URL(repoUrl.trim());
    const [, owner, repoRaw] = parsed.pathname.split("/");
    const repo = repoRaw?.replace(/\.git$/, "");

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL. Use: https://github.com/owner/repo");
    }

    const repoMeta = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoMeta.ok) {
      throw new Error("Repository not found or not accessible.");
    }

    const repoJson = (await repoMeta.json()) as { default_branch: string };
    const branch = repoJson.default_branch || "main";

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );

    if (!treeRes.ok) {
      throw new Error("Could not load repository tree from GitHub API.");
    }

    const treeJson = (await treeRes.json()) as {
      tree: Array<{ path: string; type: string; sha: string; size?: number }>;
    };

    const fileEntries = treeJson.tree.filter((item) => item.type === "blob");
    const files: FileNode[] = [];

    for (const entry of fileEntries) {
      // Guard against very large files for browser memory safety.
      if ((entry.size ?? 0) > 1_000_000) {
        continue;
      }

      const blobRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
      );

      if (!blobRes.ok) {
        continue;
      }

      const blobJson = (await blobRes.json()) as { content?: string; encoding?: string };
      if (!blobJson.content || blobJson.encoding !== "base64") {
        continue;
      }

      const content = decodeBase64Utf8(blobJson.content);

      files.push({
        path: `/${entry.path}`,
        type: "file",
        content,
      });
    }

    if (files.length === 0) {
      throw new Error("No importable files found. Repo may be empty or API-limited.");
    }

    return files;
  }
}

function decodeBase64Utf8(value: string): string {
  const normalized = value.replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}
