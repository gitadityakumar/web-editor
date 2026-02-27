import { useMemo, useState } from "react";
import { AlmostNodeRuntime } from "../../runtime/almostNodeRuntime";
import { LazyMonacoEditor } from "../editor/LazyMonacoEditor";
import {
  exportProjectZip,
  isGitHubRepoUrl,
  triggerDownload,
} from "../import-export/projectTransfer";
import { useWorkspaceStore } from "./useWorkspaceStore";

export function WorkspaceShell() {
  const {
    files,
    activePath,
    terminalOutput,
    setActivePath,
    writeActiveFile,
    addFile,
    deleteFile,
    appendTerminalOutput,
    importFiles,
  } = useWorkspaceStore();

  const [gitUrl, setGitUrl] = useState("");

  const runtime = useMemo(() => new AlmostNodeRuntime(), []);

  const activeFile = files.find((item) => item.path === activePath);

  async function runCurrentFile(): Promise<void> {
    await runtime.boot();
    await runtime.syncFiles(files);
    const result = await runtime.exec(`node ${activePath}`);
    appendTerminalOutput(result.output);
  }

  async function handleExport(): Promise<void> {
    const blob = await exportProjectZip(files, "almostnode-project");
    triggerDownload(blob, "almostnode-project.zip");
    appendTerminalOutput("Project exported as almostnode-project.zip");
  }

  async function handleGitImport(): Promise<void> {
    if (!isGitHubRepoUrl(gitUrl)) {
      appendTerminalOutput("Import failed: enter a valid GitHub repo URL.");
      return;
    }

    try {
      appendTerminalOutput(`Importing ${gitUrl} ...`);
      const imported = await runtime.importFromGitHubUrl(gitUrl);
      importFiles(imported);
      setGitUrl("");
      appendTerminalOutput("Repository import complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      appendTerminalOutput(message);
    }
  }

  return (
    <div className="layout">
      <aside className="panel files-panel">
        <div className="panel-title">Files</div>
        <div className="panel-body file-list">
          {files.map((file) => (
            <button
              className={`file-row ${file.path === activePath ? "active" : ""}`}
              key={file.path}
              onClick={() => setActivePath(file.path)}
              type="button"
            >
              {file.path}
            </button>
          ))}
        </div>
        <div className="panel-actions">
          <button onClick={() => addFile(`/new-file-${Date.now()}.js`)} type="button">
            Add File
          </button>
          <button disabled={!activePath} onClick={() => deleteFile(activePath)} type="button">
            Delete File
          </button>
        </div>
      </aside>

      <main className="panel editor-panel">
        <div className="panel-title">Editor</div>
        <div className="panel-body editor-body">
          {activeFile ? (
            <LazyMonacoEditor
              path={activeFile.path}
              value={activeFile.content ?? ""}
              onChange={writeActiveFile}
            />
          ) : (
            <div>No file selected.</div>
          )}
        </div>
      </main>

      <section className="panel tools-panel">
        <div className="panel-title">Run and Transfer</div>
        <div className="panel-actions">
          <button disabled={!activePath} onClick={() => void runCurrentFile()} type="button">
            Run Active File
          </button>
          <button onClick={() => void handleExport()} type="button">
            Export (.zip)
          </button>
        </div>

        <input
          className="import-input"
          onChange={(event) => setGitUrl(event.target.value)}
          placeholder="https://github.com/owner/repo"
          value={gitUrl}
        />
        <button onClick={() => void handleGitImport()} type="button">
          Import From Git URL
        </button>

        <div className="panel-title">Terminal Output</div>
        <pre className="terminal">{terminalOutput || "$ ready"}</pre>
      </section>
    </div>
  );
}
