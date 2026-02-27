import { create } from "zustand";
import { createDefaultVfs, VirtualFileSystem } from "../../filesystem/vfs";
import type { FileNode } from "../../filesystem/types";
import { loadWorkspace, saveWorkspace } from "../../persistence/workspaceStore";

interface WorkspaceState {
  vfs: VirtualFileSystem;
  files: FileNode[];
  activePath: string;
  terminalOutput: string;
  setActivePath: (path: string) => void;
  writeActiveFile: (content: string) => void;
  addFile: (path: string) => void;
  deleteFile: (path: string) => void;
  appendTerminalOutput: (line: string) => void;
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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  vfs: initial.vfs,
  files: initial.files,
  activePath: initial.activePath,
  terminalOutput: "",

  setActivePath: (path) => set({ activePath: path }),

  writeActiveFile: (content) => {
    const state = get();
    state.vfs.writeFile(state.activePath, content);
    const files = state.vfs.listFiles();
    saveWorkspace(files);
    set({ files });
  },

  addFile: (path) => {
    const state = get();
    state.vfs.writeFile(path, "");
    const files = state.vfs.listFiles();
    saveWorkspace(files);
    set({ files, activePath: path });
  },

  deleteFile: (path) => {
    const state = get();
    state.vfs.deleteFile(path);
    const files = state.vfs.listFiles();
    const activePath = files[0]?.path ?? "";
    saveWorkspace(files);
    set({ files, activePath });
  },

  appendTerminalOutput: (line) => {
    const state = get();
    set({ terminalOutput: `${state.terminalOutput}${line}\n` });
  },

  importFiles: (input) => {
    const vfs = new VirtualFileSystem(input);
    const files = vfs.listFiles();
    saveWorkspace(files);

    set({
      vfs,
      files,
      activePath: files[0]?.path ?? "",
      terminalOutput: "Imported workspace.",
    });
  },
}));
