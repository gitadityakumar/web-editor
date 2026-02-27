import Editor from "@monaco-editor/react";

interface MonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export default function MonacoEditor({ path, value, onChange }: MonacoEditorProps) {
  return (
    <Editor
      height="100%"
      path={path}
      defaultLanguage="javascript"
      value={value}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
      onChange={(next) => onChange(next ?? "")}
    />
  );
}
