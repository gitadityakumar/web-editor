import { create } from "zustand";
import { createDefaultVfs, VirtualFileSystem } from "../../filesystem/vfs";
import type { FileNode } from "../../filesystem/types";
import {
  loadPreviousWorkspaceSnapshot,
  loadWorkspace,
  saveWorkspace,
} from "../../persistence/workspaceStore";

const MAX_TERMINAL_BUFFER = 120_000;

interface WorkspaceState {
  vfs: VirtualFileSystem;
  files: FileNode[];
  activePath: string;
  dirtyPaths: string[];
  terminalOutput: string;
  hasHydrated: boolean;
  importInProgress: boolean;
  setActivePath: (path: string) => void;
  hydrateFromPersistence: () => Promise<void>;
  writeActiveFile: (content: string) => void;
  addFile: (path: string) => void;
  deleteFile: (path: string) => void;
  saveAll: () => Promise<void>;
  rollbackToPreviousSnapshot: () => Promise<boolean>;
  appendTerminalOutput: (text: string) => void;
  appendTerminalLine: (line: string) => void;
  clearTerminalOutput: () => void;
  importFiles: (files: FileNode[]) => Promise<void>;
  setImportInProgress: (value: boolean) => void;
}

function createInitialWorkspace(): {
  vfs: VirtualFileSystem;
  files: FileNode[];
  activePath: string;
} {
  const vfs = createDefaultVfs();
  const files = vfs.listFiles();

  return { vfs, files, activePath: files[0].path };
}

const initial = createInitialWorkspace();

function addDirtyPath(dirtyPaths: string[], path: string): string[] {
  if (dirtyPaths.includes(path)) {
    return dirtyPaths;
  }

  return [...dirtyPaths, path];
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  vfs: initial.vfs,
  files: initial.files,
  activePath: initial.activePath,
  dirtyPaths: [],
  terminalOutput: "",
  hasHydrated: false,
  importInProgress: false,

  setActivePath: (path) => set({ activePath: path }),
  setImportInProgress: (value) => set({ importInProgress: value }),

  hydrateFromPersistence: async () => {
    try {
      const saved = await loadWorkspace();
      if (!saved?.length) {
        set({ hasHydrated: true });
        return;
      }

      const vfs = new VirtualFileSystem(saved);
      const files = vfs.listFiles();

      set({
        vfs,
        files,
        activePath: files[0]?.path ?? "",
        dirtyPaths: [],
        hasHydrated: true,
      });
    } catch {
      set({ hasHydrated: true });
    }
  },

  writeActiveFile: (content) => {
    const state = get();
    state.vfs.writeFile(state.activePath, content);
    const files = state.vfs.listFiles();

    set({
      files,
      dirtyPaths: addDirtyPath(state.dirtyPaths, state.activePath),
    });
  },

  addFile: (path) => {
    const state = get();
    state.vfs.writeFile(path, "");
    const files = state.vfs.listFiles();
    void saveWorkspace(files);

    set({
      files,
      activePath: path,
      dirtyPaths: addDirtyPath(state.dirtyPaths, path),
    });
  },

  deleteFile: (path) => {
    const state = get();
    state.vfs.deleteFile(path);
    const files = state.vfs.listFiles();
    const activePath = files[0]?.path ?? "";
    void saveWorkspace(files);

    set({
      files,
      activePath,
      dirtyPaths: state.dirtyPaths.filter((entry) => entry !== path),
    });
  },

  saveAll: async () => {
    const state = get();
    await saveWorkspace(state.files);
    set({ dirtyPaths: [] });
  },

  rollbackToPreviousSnapshot: async () => {
    const previous = await loadPreviousWorkspaceSnapshot();
    if (!previous?.length) {
      return false;
    }

    const vfs = new VirtualFileSystem(previous);
    const files = vfs.listFiles();

    set({
      vfs,
      files,
      activePath: files[0]?.path ?? "",
      dirtyPaths: [],
      terminalOutput: "Rolled back to previous snapshot.\n",
    });

    return true;
  },

  appendTerminalOutput: (text) => {
    const state = get();
    const next = `${state.terminalOutput}${text}`.slice(-MAX_TERMINAL_BUFFER);
    set({ terminalOutput: next });
  },

  appendTerminalLine: (line) => {
    const state = get();
    const next = `${state.terminalOutput}${line}\n`.slice(-MAX_TERMINAL_BUFFER);
    set({ terminalOutput: next });
  },

  clearTerminalOutput: () => {
    set({ terminalOutput: "" });
  },

  importFiles: async (input) => {
    const vfs = new VirtualFileSystem(input);
    const files = vfs.listFiles();
    await saveWorkspace(files);

    set({
      vfs,
      files,
      activePath: files[0]?.path ?? "",
      dirtyPaths: [],
      terminalOutput: "Imported workspace.\n",
    });
  },
}));
