import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AlmostNodeRuntime } from "../../runtime/almostNodeRuntime";
import { LazyMonacoEditor } from "../editor/LazyMonacoEditor";
import {
  exportProjectZip,
  isGitHubRepoUrl,
  triggerDownload,
} from "../import-export/projectTransfer";
import { useWorkspaceStore } from "./useWorkspaceStore";

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 520;
const SIDEBAR_COLLAPSE_THRESHOLD = 190;

const MIN_TERMINAL_HEIGHT = 140;
const MAX_TERMINAL_HEIGHT = 520;
const TERMINAL_COLLAPSED_HEIGHT = 34;
const MAX_SEARCH_RESULTS = 200;

type IconProps = { className?: string };
type SidebarView = "explorer" | "import" | "search";

interface SearchResult {
  path: string;
  line: number;
  column: number;
  preview: string;
}

function FilesIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H4z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 6a2 2 0 0 1 2-2h4l2 2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ImportIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 4v10" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function GitIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 7.5h8M7.5 8.5l3.5 7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function NewFileIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 4h8l4 4v12H6z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 4v4h4M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function RunIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="m8 6 10 6-10 6z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function StopIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <rect x="7" y="7" width="10" height="10" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ExportIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 4v10" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8 8 4-4 4 4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SaveIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 5h12l2 2v12H5z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 5v5h8V5M8 19v-6h8v6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function HistoryIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 12a7 7 0 1 0 2-4.9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 5v4h4M12 8v4l3 2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function MinimizeIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ExpandIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 16h14M5 8h14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ClearIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 7h12M7 7l1 12h8l1-12M10 7V5h4v2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const activityBtnClass =
  "grid size-9 place-items-center rounded-lg border-0 bg-transparent text-[#7f8aa4] hover:bg-[#1a2133] hover:text-[#d7e4ff]";
const iconBtnClass =
  "grid size-[30px] place-items-center rounded-md border border-[#2e3d5c] bg-[#1a2640] p-0 text-[#dbe7ff] disabled:opacity-50 disabled:cursor-not-allowed";

export function WorkspaceShell() {
  const {
    files,
    activePath,
    dirtyPaths,
    terminalOutput,
    setActivePath,
    writeActiveFile,
    addFile,
    deleteFile,
    saveAll,
    rollbackToPreviousSnapshot,
    appendTerminalOutput,
    appendTerminalLine,
    clearTerminalOutput,
    importFiles,
  } = useWorkspaceStore();

  const [gitUrl, setGitUrl] = useState("");
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);

  const [terminalInput, setTerminalInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  const runtime = useMemo(() => new AlmostNodeRuntime(), []);
  const activeFile = files.find((item) => item.path === activePath);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const gitInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const hasUnsavedChanges = dirtyPaths.length > 0;
  const isFileDirty = dirtyPaths.includes(activePath);

  const searchResults = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) {
      return [] as SearchResult[];
    }

    const matches: SearchResult[] = [];
    for (const file of files) {
      const lines = (file.content ?? "").split(/\r?\n/u);
      for (let index = 0; index < lines.length; index += 1) {
        const lineText = lines[index];
        const column = lineText.toLowerCase().indexOf(needle);
        if (column === -1) {
          continue;
        }

        matches.push({
          path: file.path,
          line: index + 1,
          column: column + 1,
          preview: lineText.trim() || "(empty line)",
        });

        if (matches.length >= MAX_SEARCH_RESULTS) {
          return matches;
        }
      }
    }

    return matches;
  }, [files, searchQuery]);

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    function onPointerMove(event: PointerEvent): void {
      const shellBounds = shellRef.current?.getBoundingClientRect();
      const leftInset = shellBounds?.left ?? 0;
      const offsetAfterActivityBar = 52;
      const nextRaw = event.clientX - leftInset - offsetAfterActivityBar;

      if (nextRaw <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setIsExplorerCollapsed(true);
        return;
      }

      const next = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, nextRaw));
      setIsExplorerCollapsed(false);
      setSidebarWidth(next);
    }

    function onPointerUp(): void {
      setIsResizingSidebar(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!isResizingTerminal) {
      return;
    }

    function onPointerMove(event: PointerEvent): void {
      const bounds = shellRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      const distanceFromBottom = bounds.bottom - event.clientY;
      const next = Math.max(MIN_TERMINAL_HEIGHT, Math.min(MAX_TERMINAL_HEIGHT, distanceFromBottom));

      setIsTerminalMinimized(false);
      setTerminalHeight(next);
    }

    function onPointerUp(): void {
      setIsResizingTerminal(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isResizingTerminal]);

  useEffect(() => {
    if (sidebarView === "import") {
      gitInputRef.current?.focus();
      return;
    }

    if (sidebarView === "search") {
      searchInputRef.current?.focus();
    }
  }, [sidebarView]);

  useEffect(() => {
    if (!showCommandPalette) {
      return;
    }

    paletteInputRef.current?.focus();
  }, [showCommandPalette]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  async function runTerminalCommand(rawCommand: string): Promise<void> {
    const command = rawCommand.trim();
    if (!command) {
      return;
    }

    appendTerminalLine(`$ ${command}`);
    setHistory((prev) => [...prev, command]);
    setHistoryIndex(null);
    setTerminalInput("");

    try {
      setIsTerminalMinimized(false);
      setIsCommandRunning(true);
      await runtime.syncFiles(files);

      const result = await runtime.runCommand(command, {
        onStdout: (chunk) => appendTerminalOutput(chunk),
        onStderr: (chunk) => appendTerminalOutput(chunk),
      });

      if (result.exitCode !== 0) {
        appendTerminalLine(`[exit ${result.exitCode}]`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminalLine(`[error] ${message}`);
    } finally {
      setIsCommandRunning(false);
    }
  }

  async function runCurrentFile(): Promise<void> {
    if (!activePath) {
      return;
    }

    await runTerminalCommand(`node ${activePath}`);
  }

  function stopRunningCommand(): void {
    runtime.stopRunningCommand();
    appendTerminalLine("[stop] requested");
  }

  async function handleExport(): Promise<void> {
    const blob = await exportProjectZip(files, "almostnode-project");
    triggerDownload(blob, "almostnode-project.zip");
    appendTerminalLine("Project exported as almostnode-project.zip");
  }

  async function handleGitImport(): Promise<void> {
    if (!isGitHubRepoUrl(gitUrl)) {
      appendTerminalLine("Import failed: enter a valid GitHub repo URL.");
      return;
    }

    try {
      appendTerminalLine(`Importing ${gitUrl} ...`);
      const imported = await runtime.importFromGitHubUrl(gitUrl);
      importFiles(imported);
      setGitUrl("");
      appendTerminalLine("Repository import complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      appendTerminalLine(message);
    }
  }

  function openExplorer(): void {
    setIsExplorerCollapsed(false);
    setSidebarView("explorer");
  }

  function toggleGitPanel(): void {
    setIsExplorerCollapsed(false);
    setSidebarView((prev) => (prev === "import" ? "explorer" : "import"));
  }

  function toggleSearchPanel(): void {
    setIsExplorerCollapsed(false);
    setSidebarView((prev) => (prev === "search" ? "explorer" : "search"));
  }

  const toggleTerminalMinimized = useCallback((): void => {
    setIsTerminalMinimized((prev) => !prev);
  }, []);

  const handleSaveAll = useCallback((): void => {
    saveAll();
    appendTerminalLine("Saved workspace snapshot.");
  }, [appendTerminalLine, saveAll]);

  const handleRollbackSnapshot = useCallback((): void => {
    const rolledBack = rollbackToPreviousSnapshot();
    if (!rolledBack) {
      appendTerminalLine("No previous snapshot available.");
    }
  }, [appendTerminalLine, rollbackToPreviousSnapshot]);

  function handleTerminalInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();

      if (isCommandRunning) {
        if (terminalInput.trim()) {
          runtime.sendInput(`${terminalInput}\n`);
          appendTerminalLine(`> ${terminalInput}`);
          setTerminalInput("");
        }

        return;
      }

      void runTerminalCommand(terminalInput);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) {
        return;
      }

      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setTerminalInput(history[nextIndex]);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (history.length === 0 || historyIndex === null) {
        return;
      }

      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setTerminalInput("");
        return;
      }

      setHistoryIndex(nextIndex);
      setTerminalInput(history[nextIndex]);
    }
  }

  const paletteCommands = [
    {
      id: "run-file",
      label: "Run active file",
      keywords: "run execute node",
      disabled: !activePath,
      run: () => {
        void runCurrentFile();
      },
    },
    {
      id: "save-all",
      label: "Save all files",
      keywords: "save persist snapshot",
      run: handleSaveAll,
    },
    {
      id: "rollback",
      label: "Rollback to previous snapshot",
      keywords: "revert restore history snapshot",
      run: handleRollbackSnapshot,
    },
    {
      id: "search",
      label: "Open project search",
      keywords: "find grep search",
      run: toggleSearchPanel,
    },
    {
      id: "git-import",
      label: "Open Git import panel",
      keywords: "import github repo",
      run: toggleGitPanel,
    },
    {
      id: "toggle-terminal",
      label: "Toggle terminal",
      keywords: "terminal panel",
      run: toggleTerminalMinimized,
    },
    {
      id: "clear-terminal",
      label: "Clear terminal output",
      keywords: "clear terminal",
      run: clearTerminalOutput,
    },
    {
      id: "export-zip",
      label: "Export workspace zip",
      keywords: "download export zip",
      run: () => {
        void handleExport();
      },
    },
  ];

  const filteredPaletteCommands = (() => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) {
      return paletteCommands;
    }

    return paletteCommands.filter((command) => {
      return `${command.label} ${command.keywords}`.toLowerCase().includes(query);
    });
  })();

  useEffect(() => {
    function onWindowKeyDown(event: globalThis.KeyboardEvent): void {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) {
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSaveAll();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsExplorerCollapsed(false);
        setSidebarView("search");
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setShowCommandPalette(true);
        setPaletteQuery("");
        return;
      }

      if (event.key === "`") {
        event.preventDefault();
        toggleTerminalMinimized();
      }
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [handleSaveAll, toggleTerminalMinimized]);

  function runPaletteCommand(index: number): void {
    const selected = filteredPaletteCommands[index];
    if (!selected || selected.disabled) {
      return;
    }

    selected.run();
    setShowCommandPalette(false);
    setPaletteQuery("");
  }

  function onPaletteInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setShowCommandPalette(false);
      setPaletteQuery("");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runPaletteCommand(0);
    }
  }

  return (
    <div
      className="grid h-full grid-rows-[44px_1fr] overflow-hidden bg-[radial-gradient(circle_at_80%_0%,#182338,#0f111a_55%)] text-[#d5dbe7]"
      ref={shellRef}
    >
      <header className="relative flex items-center justify-center border-b border-[#2a3040] bg-[#0b0f18]">
        <div className="absolute left-3 text-[10px] tracking-[0.25em] text-[#6d778d]">● ● ●</div>
        <div className="text-[13px] text-[#9eabc7]">project-27feb</div>
      </header>

      <div
        className="grid min-h-0"
        style={{
          gridTemplateColumns: `52px ${isExplorerCollapsed ? "0px" : `${sidebarWidth}px`} 6px 1fr`,
        }}
      >
        <nav
          className="flex flex-col items-center gap-2 border-r border-[#2a3040] bg-[#101522] py-2.5"
          aria-label="Activity Bar"
        >
          <button
            aria-label="Explorer"
            className={`${activityBtnClass} ${sidebarView === "explorer" ? "bg-[#1a2133] text-[#d7e4ff]" : ""}`}
            onClick={openExplorer}
            title="Explorer"
            type="button"
          >
            <FilesIcon className="size-[18px]" />
          </button>
          <button
            aria-label="Git Import"
            className={`${activityBtnClass} ${sidebarView === "import" ? "bg-[#1a2133] text-[#d7e4ff]" : ""}`}
            onClick={toggleGitPanel}
            title="Git Import"
            type="button"
          >
            <ImportIcon className="size-[18px]" />
          </button>
          <button
            aria-label="Search"
            className={`${activityBtnClass} ${sidebarView === "search" ? "bg-[#1a2133] text-[#d7e4ff]" : ""}`}
            onClick={toggleSearchPanel}
            title="Search"
            type="button"
          >
            <SearchIcon className="size-[18px]" />
          </button>
          <button
            aria-label="Source Control"
            className={activityBtnClass}
            title="Source Control"
            type="button"
          >
            <GitIcon className="size-[18px]" />
          </button>
        </nav>

        <aside
          className="flex min-w-0 flex-col border-r border-[#2a3040] bg-[#141824]"
          style={{ visibility: isExplorerCollapsed ? "hidden" : "visible" }}
        >
          <div className="flex h-10 items-center justify-between border-b border-[#23293a] px-3 text-[12px] tracking-[0.8px] text-[#8f9bb3]">
            <span>
              {sidebarView === "import"
                ? "GITHUB IMPORT"
                : sidebarView === "search"
                  ? "SEARCH"
                  : "EXPLORER"}
            </span>
            <div className="flex gap-1.5">
              <button
                aria-label={sidebarView === "import" ? "Show Explorer" : "Show Git Import"}
                className={iconBtnClass}
                onClick={toggleGitPanel}
                title={sidebarView === "import" ? "Show Explorer" : "Show Git Import"}
                type="button"
              >
                <ImportIcon className="size-[15px]" />
              </button>
              <button
                aria-label={sidebarView === "search" ? "Show Explorer" : "Show Search"}
                className={iconBtnClass}
                onClick={toggleSearchPanel}
                title={sidebarView === "search" ? "Show Explorer" : "Show Search"}
                type="button"
              >
                <SearchIcon className="size-[15px]" />
              </button>
              <button
                aria-label="New File"
                className={iconBtnClass}
                onClick={() => addFile(`/new-file-${Date.now()}.js`)}
                title="New File"
                type="button"
              >
                <NewFileIcon className="size-[15px]" />
              </button>
            </div>
          </div>

          {sidebarView === "import" ? (
            <div className="grid gap-2.5 p-2.5">
              <input
                className="w-full rounded-md border border-[#28324a] bg-[#0f1628] px-2.5 py-2 text-[#dde7fb]"
                ref={gitInputRef}
                onChange={(event) => setGitUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
                value={gitUrl}
              />
              <button
                className="cursor-pointer rounded-md border border-[#2e3d5c] bg-[#1a2640] px-2.5 py-1.5 text-[#dbe7ff]"
                onClick={() => void handleGitImport()}
                type="button"
              >
                Import From Git URL
              </button>
            </div>
          ) : sidebarView === "search" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
              <input
                className="w-full rounded-md border border-[#28324a] bg-[#0f1628] px-2.5 py-2 text-[#dde7fb] outline-none"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search across files..."
                ref={searchInputRef}
                value={searchQuery}
              />
              <div className="text-[11px] text-[#7f8aa4]">
                {searchQuery.trim()
                  ? `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`
                  : "Type to search"}
              </div>
              <div className="min-h-0 overflow-auto pr-0.5">
                {searchResults.map((result, index) => {
                  return (
                    <button
                      className="mb-1.5 grid w-full cursor-pointer gap-1 rounded-md border border-transparent bg-[#0f1628] px-2 py-1.5 text-left text-[#c6d3ea] hover:border-[#2a3a59] hover:bg-[#18243b]"
                      key={`${result.path}:${result.line}:${result.column}:${index}`}
                      onClick={() => setActivePath(result.path)}
                      type="button"
                    >
                      <span className="truncate text-[11px] text-[#8ea0c6]">
                        {result.path.replace(/^\//, "")}:{result.line}:{result.column}
                      </span>
                      <span className="truncate text-[12px]">{result.preview}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2">
              {files.map((file) => {
                const isActive = file.path === activePath;
                const isDirty = dirtyPaths.includes(file.path);

                return (
                  <div
                    className={`group grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-md border p-0.5 ${
                      isActive
                        ? "border-[#2f3a53] bg-[#26314a] text-[#e5ecfb]"
                        : "border-transparent bg-transparent text-[#b9c3d8] hover:bg-[#1a2235]"
                    }`}
                    key={file.path}
                  >
                    <button
                      className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-[5px] border-0 bg-transparent px-[7px] py-1.5 text-left text-[12px] text-inherit"
                      onClick={() => setActivePath(file.path)}
                      type="button"
                    >
                      {file.path.replace(/^\//, "")}
                      {isDirty ? " *" : ""}
                    </button>
                    <button
                      aria-label={`Delete ${file.path}`}
                      className={`grid size-6 place-items-center rounded-[5px] border-0 bg-transparent p-0 text-[#b1bfd7] hover:bg-[rgba(255,70,70,0.15)] hover:text-[#ff9e9e] ${
                        isActive
                          ? "opacity-100"
                          : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                      }`}
                      onClick={() => deleteFile(file.path)}
                      title={`Delete ${file.path}`}
                      type="button"
                    >
                      <TrashIcon className="size-[15px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <div
          aria-label="Resize Sidebar"
          className={`w-1.5 cursor-col-resize border-r border-r-transparent ${
            isResizingSidebar
              ? "bg-[rgba(47,129,247,0.25)] border-r-[rgba(47,129,247,0.6)]"
              : "hover:bg-[rgba(47,129,247,0.25)] hover:border-r-[rgba(47,129,247,0.6)]"
          }`}
          onPointerDown={() => setIsResizingSidebar(true)}
          role="separator"
        />

        <section
          className="grid min-h-0 min-w-0 bg-[#0f111a]"
          style={{
            gridTemplateRows: `36px minmax(220px, 1fr) 6px ${isTerminalMinimized ? `${TERMINAL_COLLAPSED_HEIGHT}px` : `${terminalHeight}px`}`,
          }}
        >
          <div className="flex items-center border-b border-[#2a3040] bg-[#111725] px-3 text-[12px] text-[#aeb9d2]">
            {activePath || "untitled"}
            {isFileDirty ? " *" : ""}
          </div>

          <div className="min-h-0 border-b border-[#2a3040] bg-[#0f1320]">
            {activeFile ? (
              <LazyMonacoEditor
                path={activeFile.path}
                value={activeFile.content ?? ""}
                onChange={writeActiveFile}
              />
            ) : (
              <div className="grid h-full place-items-center text-[#8f9bb3]">No file selected.</div>
            )}
          </div>

          <div
            className={`h-1.5 cursor-row-resize border-t border-t-transparent ${
              isResizingTerminal
                ? "bg-[rgba(47,129,247,0.25)] border-t-[rgba(47,129,247,0.6)]"
                : "hover:bg-[rgba(47,129,247,0.25)] hover:border-t-[rgba(47,129,247,0.6)]"
            }`}
            onPointerDown={() => setIsResizingTerminal(true)}
            role="separator"
          />

          <div
            className={`grid min-h-0 bg-[#0d121f] ${
              isTerminalMinimized ? "grid-rows-1" : "grid-rows-[42px_1fr_44px]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#23293a] px-3 text-[12px] text-[#8f9bb3]">
              <span>TERMINAL</span>
              <div className="flex gap-2">
                <button
                  aria-label="Save All"
                  className={iconBtnClass}
                  onClick={handleSaveAll}
                  title="Save All (Ctrl/Cmd + S)"
                  type="button"
                >
                  <SaveIcon className="size-[15px]" />
                </button>
                <button
                  aria-label="Rollback Snapshot"
                  className={iconBtnClass}
                  onClick={handleRollbackSnapshot}
                  title="Rollback Snapshot"
                  type="button"
                >
                  <HistoryIcon className="size-[15px]" />
                </button>
                <button
                  aria-label={isTerminalMinimized ? "Expand Terminal" : "Minimize Terminal"}
                  className={iconBtnClass}
                  onClick={toggleTerminalMinimized}
                  title={isTerminalMinimized ? "Expand Terminal" : "Minimize Terminal"}
                  type="button"
                >
                  {isTerminalMinimized ? (
                    <ExpandIcon className="size-[15px]" />
                  ) : (
                    <MinimizeIcon className="size-[15px]" />
                  )}
                </button>
                <button
                  aria-label="Clear Terminal"
                  className={iconBtnClass}
                  onClick={clearTerminalOutput}
                  title="Clear Terminal"
                  type="button"
                >
                  <ClearIcon className="size-[15px]" />
                </button>
                <button
                  aria-label={isCommandRunning ? "Stop Command" : "Run Active File"}
                  className={iconBtnClass}
                  disabled={!activePath && !isCommandRunning}
                  onClick={isCommandRunning ? stopRunningCommand : () => void runCurrentFile()}
                  title={isCommandRunning ? "Stop Command" : "Run Active File"}
                  type="button"
                >
                  {isCommandRunning ? (
                    <StopIcon className="size-[15px]" />
                  ) : (
                    <RunIcon className="size-[15px]" />
                  )}
                </button>
                <button
                  aria-label="Export Zip"
                  className={iconBtnClass}
                  onClick={() => void handleExport()}
                  title="Export Zip"
                  type="button"
                >
                  <ExportIcon className="size-[15px]" />
                </button>
              </div>
            </div>

            {!isTerminalMinimized ? (
              <pre className="m-0 overflow-auto px-3 py-2.5 text-[12px] leading-[1.45] text-[#a9bfdf]">
                {terminalOutput || "$ ready\nType a command and press Enter"}
              </pre>
            ) : null}

            {!isTerminalMinimized ? (
              <div className="flex items-center gap-2 border-t border-[#23293a] px-3">
                <span className="text-xs text-[#6f7a93]">$</span>
                <input
                  className="h-8 w-full border-0 bg-transparent text-xs text-[#d8e4fd] outline-none"
                  onChange={(event) => setTerminalInput(event.target.value)}
                  onKeyDown={handleTerminalInputKeyDown}
                  placeholder={isCommandRunning ? "Send input to running command" : "pnpm install"}
                  value={terminalInput}
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {showCommandPalette ? (
        <div
          className="absolute inset-0 z-30 grid place-items-start bg-[rgba(4,8,15,0.55)] px-4 pt-14"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCommandPalette(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setShowCommandPalette(false);
            }
          }}
          aria-modal="true"
          role="dialog"
          tabIndex={0}
        >
          <div className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[#2a3a58] bg-[#0f1627] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="border-b border-[#22314d] px-3 py-2.5">
              <input
                className="w-full border-0 bg-transparent text-[13px] text-[#d9e6ff] outline-none"
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={onPaletteInputKeyDown}
                placeholder="Type a command... (Ctrl/Cmd + Shift + P)"
                ref={paletteInputRef}
                value={paletteQuery}
              />
            </div>
            <div className="max-h-[320px] overflow-auto p-2">
              {filteredPaletteCommands.map((command, index) => {
                return (
                  <button
                    className={`mb-1 block w-full cursor-pointer rounded-md border px-2.5 py-2 text-left text-[12px] ${
                      command.disabled
                        ? "cursor-not-allowed border-transparent bg-[#111a2b] text-[#6c7994]"
                        : "border-transparent bg-[#111a2b] text-[#d4e3ff] hover:border-[#2a3d61] hover:bg-[#18253d]"
                    }`}
                    key={command.id}
                    onClick={() => runPaletteCommand(index)}
                    type="button"
                  >
                    {command.label}
                  </button>
                );
              })}
              {filteredPaletteCommands.length === 0 ? (
                <div className="px-2 py-3 text-[12px] text-[#7d8ca8]">No matching commands.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
