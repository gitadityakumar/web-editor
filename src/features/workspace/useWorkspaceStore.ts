import { create } from "zustand";
import { createDefaultVfs, VirtualFileSystem } from "../../filesystem/vfs";
import type { FileNode } from "../../filesystem/types";
import {
  loadPreviousWorkspaceSnapshot,
  loadWorkspace,
  saveWorkspace,
} from "../../persistence/workspaceStore";

interface WorkspaceState {
  vfs: VirtualFileSystem;
  files: FileNode[];
  activePath: string;
  dirtyPaths: string[];
  terminalOutput: string;
  setActivePath: (path: string) => void;
  writeActiveFile: (content: string) => void;
  addFile: (path: string) => void;
  deleteFile: (path: string) => void;
  saveAll: () => void;
  rollbackToPreviousSnapshot: () => boolean;
  appendTerminalOutput: (text: string) => void;
  appendTerminalLine: (line: string) => void;
  clearTerminalOutput: () => void;
  importFiles: (files: FileNode[]) => void;
}

function hydrateVfs(): { vfs: VirtualFileSystem; files: FileNode[]; activePath: string } {
  const saved = loadWorkspace();

  if (saved?.length) {
    const vfs = new VirtualFileSystem(saved);
    const files = vfs.listFiles();

    return { vfs, files, activePath: files[0].path };
  }

  const vfs = createDefaultVfs();
  const files = vfs.listFiles();

  return { vfs, files, activePath: files[0].path };
}

const initial = hydrateVfs();

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

  setActivePath: (path) => set({ activePath: path }),

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
    saveWorkspace(files);

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
    saveWorkspace(files);

    set({
      files,
      activePath,
      dirtyPaths: state.dirtyPaths.filter((entry) => entry !== path),
    });
  },

  saveAll: () => {
    const state = get();
    saveWorkspace(state.files);
    set({ dirtyPaths: [] });
  },

  rollbackToPreviousSnapshot: () => {
    const previous = loadPreviousWorkspaceSnapshot();
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
    set({ terminalOutput: `${state.terminalOutput}${text}` });
  },

  appendTerminalLine: (line) => {
    const state = get();
    set({ terminalOutput: `${state.terminalOutput}${line}\n` });
  },

  clearTerminalOutput: () => {
    set({ terminalOutput: "" });
  },

  importFiles: (input) => {
    const vfs = new VirtualFileSystem(input);
    const files = vfs.listFiles();
    saveWorkspace(files);

    set({
      vfs,
      files,
      activePath: files[0]?.path ?? "",
      dirtyPaths: [],
      terminalOutput: "Imported workspace.\n",
    });
  },
}));
