import type { CodeLanguage } from "./languages";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/rust/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/java/register";
import "monaco-editor/languages/definitions/cpp/register";
import "monaco-editor/languages/definitions/go/register";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { useTheme } from "next-themes";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export default function CodeExerciseEdit({ source, onChange, language = "rust", readOnly = false }: { source: string; language?: CodeLanguage; onChange(source: string): void; readOnly?: boolean }) {
  const { resolvedTheme } = useTheme();
  return <Editor height="360px" language={language} value={source} onChange={v => onChange(v ?? "")} theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
    options={{ readOnly, minimap: { enabled: false }, fontSize: 14, tabSize: 4, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: "on", accessibilitySupport: "on" }} />;
}
