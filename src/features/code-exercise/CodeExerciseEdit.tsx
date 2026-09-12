import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/rust/register";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { useTheme } from "next-themes";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export default function CodeExerciseEdit({ source, onChange, readOnly = false }: { source: string; onChange(source: string): void; readOnly?: boolean }) {
  const { resolvedTheme } = useTheme();
  return <Editor height="360px" language="rust" value={source} onChange={v => onChange(v ?? "")} theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
    options={{ readOnly, minimap: { enabled: false }, fontSize: 14, tabSize: 4, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: "on", accessibilitySupport: "on" }} />;
}
