import type { FileNode } from "../filesystem/types";
import type { RunResult } from "almostnode";

export interface RuntimeCommandResult {
  ok: boolean;
  output: string;
}

interface RunCommandOptions {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  timeoutMs?: number;
}

export class AlmostNodeRuntime {
  private container: any | null = null;
  private running = false;
  private currentCommandAbort: AbortController | null = null;
  private commandRunning = false;
  private bootPromise: Promise<void> | null = null;
  private syncedPaths = new Set<string>();

  isRunning(): boolean {
    return this.running;
  }

  async boot(): Promise<void> {
    if (this.container && this.running) {
      this.running = true;
      return;
    }

    if (this.bootPromise) {
      await this.bootPromise;
      return;
    }

    this.bootPromise = (async () => {
      const { createContainer } = await import("almostnode");
      const bootTimeoutMs = 15_000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Runtime boot timed out.")), bootTimeoutMs);
      });

      this.container = await Promise.race([Promise.resolve(createContainer()), timeoutPromise]);
      this.running = true;
    })();

    try {
      await this.bootPromise;
    } catch (error) {
      this.container = null;
      this.running = false;
      throw error;
    } finally {
      this.bootPromise = null;
    }
  }

  async shutdown(): Promise<void> {
    this.stopRunningCommand();

    if (
      this.container &&
      typeof (this.container as { destroy?: () => Promise<void> }).destroy === "function"
    ) {
      await (this.container as { destroy: () => Promise<void> }).destroy();
    }

    this.container = null;
    this.running = false;
    this.syncedPaths.clear();
  }

  async restart(): Promise<void> {
    await this.shutdown();
    await this.boot();
  }

  async syncFiles(files: FileNode[]): Promise<void> {
    await this.boot();
    const nextPaths = new Set<string>();

    for (const file of files) {
      if (file.type !== "file") {
        continue;
      }

      nextPaths.add(file.path);
      this.container.vfs.writeFileSync(file.path, file.content ?? "");
    }

    for (const oldPath of this.syncedPaths) {
      if (nextPaths.has(oldPath)) {
        continue;
      }

      try {
        this.container.vfs.unlinkSync(oldPath);
      } catch {
        // File might not exist in runtime; ignore cleanup misses.
      }
    }

    this.syncedPaths = nextPaths;
  }

  async exec(command: string): Promise<RuntimeCommandResult> {
    const result = await this.runCommand(command);

    return {
      ok: result.exitCode === 0,
      output:
        [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
        `[almostnode] command finished: ${command}`,
    };
  }

  isCommandRunning(): boolean {
    return this.commandRunning;
  }

  sendInput(data: string): void {
    if (!this.container) {
      return;
    }

    this.container.sendInput(data);
  }

  stopRunningCommand(): void {
    this.currentCommandAbort?.abort();
  }

  async runCommand(command: string, options: RunCommandOptions = {}): Promise<RunResult> {
    await this.boot();

    if (this.commandRunning) {
      throw new Error("A command is already running. Stop it before starting another.");
    }

    this.currentCommandAbort = new AbortController();
    this.commandRunning = true;
    const timeoutMs = options.timeoutMs ?? 60_000;
    const timeoutId = setTimeout(() => {
      this.currentCommandAbort?.abort();
    }, timeoutMs);

    try {
      const result = await this.container.run(command, {
        onStdout: options.onStdout,
        onStderr: options.onStderr,
        signal: this.currentCommandAbort.signal,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && /abort/i.test(error.message)) {
        return { stdout: "", stderr: "Command stopped.", exitCode: 130 };
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      this.currentCommandAbort = null;
      this.commandRunning = false;
    }
  }

  async importFromGitHubUrl(repoUrl: string): Promise<FileNode[]> {
    const parsed = new URL(normalizeGitHubUrl(repoUrl));
    if (parsed.hostname !== "github.com") {
      throw new Error("Only github.com repository URLs are supported.");
    }

    const [, owner, repoRaw] = parsed.pathname.split("/");
    const repo = repoRaw?.replace(/\.git$/, "");

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL. Use: https://github.com/owner/repo");
    }

    const requestedRef = parseRequestedRef(parsed);
    const repoMeta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        accept: "application/vnd.github+json",
      },
    });

    if (!repoMeta.ok) {
      throw new Error(formatGitHubApiError(repoMeta));
    }

    const repoJson = (await repoMeta.json()) as { default_branch?: string; private?: boolean };
    if (repoJson.private) {
      throw new Error("Private repositories are not supported in this single-user MVP.");
    }

    const ref = requestedRef || repoJson.default_branch || "main";
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
      {
        headers: {
          accept: "application/vnd.github+json",
        },
      },
    );

    if (!commitRes.ok) {
      throw new Error(formatGitHubApiError(commitRes));
    }

    const commitJson = (await commitRes.json()) as { sha?: string };
    const commitSha = commitJson.sha;
    if (!commitSha) {
      throw new Error("Could not resolve repository ref to a commit.");
    }

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
      {
        headers: {
          accept: "application/vnd.github+json",
        },
      },
    );

    if (!treeRes.ok) {
      throw new Error(formatGitHubApiError(treeRes));
    }

    const treeJson = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>;
      truncated?: boolean;
    };

    if (!Array.isArray(treeJson.tree) || treeJson.tree.length === 0) {
      throw new Error("Repository tree is empty.");
    }

    if (treeJson.truncated) {
      throw new Error("Repository is too large for direct browser import.");
    }

    const maxFileBytes = 1_000_000;
    const maxTotalBytes = 8_000_000;
    const maxFiles = 400;
    let totalBytes = 0;
    const blobEntries = treeJson.tree
      .filter((entry) => entry.type === "blob")
      .filter((entry) => Boolean(entry.path) && Boolean(entry.sha))
      .filter((entry) => looksLikeTextFile(entry.path ?? ""))
      .filter((entry) => (entry.size ?? 0) <= maxFileBytes)
      .slice(0, maxFiles);

    const files: FileNode[] = [];
    const blobs = await mapWithConcurrency(blobEntries, 8, async (entry) => {
      const blobRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
        {
          headers: {
            accept: "application/vnd.github+json",
          },
        },
      );

      if (!blobRes.ok) {
        return null;
      }

      const blobJson = (await blobRes.json()) as {
        content?: string;
        encoding?: string;
        size?: number;
      };
      if (!blobJson.content || blobJson.encoding !== "base64") {
        return null;
      }

      const size = blobJson.size ?? entry.size ?? 0;
      if (size > maxFileBytes || totalBytes + size > maxTotalBytes) {
        return null;
      }

      const content = decodeBase64Utf8(blobJson.content);
      if (content === null) {
        return null;
      }

      totalBytes += size;
      return {
        path: `/${entry.path}`,
        type: "file" as const,
        content,
      };
    });

    for (const file of blobs) {
      if (file) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      throw new Error("No importable text files found in repository.");
    }

    return files;
  }
}

function normalizeGitHubUrl(input: string): string {
  const value = input.trim();
  if (value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("http://")) {
    return `https://${value.slice("http://".length)}`;
  }
  return `https://${value}`;
}

function parseRequestedRef(parsed: URL): string | null {
  const refQuery = parsed.searchParams.get("ref");
  if (refQuery?.trim()) {
    return refQuery.trim();
  }

  if (parsed.hash.trim()) {
    return decodeURIComponent(parsed.hash.slice(1)).trim();
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length >= 4 && parts[2] === "tree") {
    return decodeURIComponent(parts.slice(3).join("/")).trim();
  }

  return null;
}

function formatGitHubApiError(response: Response): string {
  if (response.status === 404) {
    return "Repository not found or ref does not exist.";
  }

  if (response.status === 403) {
    const reset = response.headers.get("x-ratelimit-reset");
    if (reset) {
      const resetDate = new Date(Number.parseInt(reset, 10) * 1000);
      return `GitHub API rate limit reached. Try again after ${resetDate.toLocaleTimeString()}.`;
    }
    return "GitHub API access denied (possibly rate-limited).";
  }

  if (response.status === 401) {
    return "Repository requires authentication and cannot be imported anonymously.";
  }

  return `GitHub API request failed (${response.status}).`;
}

function looksLikeTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  const blockedSuffixes = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".wasm",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".mp4",
    ".mp3",
    ".mov",
    ".avi",
  ];

  return !blockedSuffixes.some((suffix) => lower.endsWith(suffix));
}

function decodeBase64Utf8(value: string): string | null {
  const normalized = value.replaceAll("\n", "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

async function mapWithConcurrency<TIn, TOut>(
  input: TIn[],
  limit: number,
  mapper: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
  const result: TOut[] = new Array(input.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= input.length) {
        return;
      }

      result[index] = await mapper(input[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, input.length) }, () => runWorker());
  await Promise.all(workers);
  return result;
}
