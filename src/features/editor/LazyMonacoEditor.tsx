import { lazy, Suspense } from "react";

const MonacoEditor = lazy(() => import("./MonacoEditor"));

interface LazyMonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
  return (
    <Suspense fallback={<div className="panel-body">Loading editor...</div>}>
      <MonacoEditor {...props} />
    </Suspense>
  );
}
