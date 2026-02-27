import { lazy, Suspense } from "react";

const MonacoEditor = lazy(() => import("./MonacoEditor"));

interface LazyMonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
  return (
    <Suspense fallback={<div className="p-3 text-xs text-[#8f9bb3]">Loading editor...</div>}>
      <MonacoEditor {...props} />
    </Suspense>
  );
}
