import type { CodeLanguage } from "./languages";
import { useEffect } from "react";
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

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const THEME = "corelia-code";
const DARK_RULES = [
  { token: "keyword", foreground: "ff8787" },
  { token: "string", foreground: "2fe921" },
  { token: "number", foreground: "ffa159" },
  { token: "type", foreground: "1ebfff" },
  { token: "comment", foreground: "596587" },
];

// Monaco cannot read CSS variables, so resolve the design tokens whenever the theme changes.
function applyCodeTheme() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const dark = root.classList.contains("dark");
  const surface = token("--code-block-surface");
  monaco.editor.defineTheme(THEME, {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: dark ? DARK_RULES : [],
    colors: {
      "editor.background": surface,
      "editorGutter.background": surface,
      "editorLineNumber.foreground": token("--neutral-500"),
      "editorLineNumber.activeForeground": token("--neutral-500"),
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
    },
  });
  monaco.editor.setTheme(THEME);
}

export default function CodeExerciseEdit({ source, onChange, language = "rust", readOnly = false }: { source: string; language?: CodeLanguage; onChange(source: string): void; readOnly?: boolean }) {
  useEffect(() => {
    const observer = new MutationObserver(applyCodeTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const height = Math.min(520, Math.max(280, source.split("\n").length * 32 + 40));
  return <Editor height={`${height}px`} language={language} value={source} onChange={v => onChange(v ?? "")} theme={THEME} beforeMount={applyCodeTheme}
    options={{ readOnly, minimap: { enabled: false }, fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace', fontSize: 16, letterSpacing: -0.16, lineHeight: 32, tabSize: 4, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: "on", accessibilitySupport: "on", padding: { top: 20, bottom: 20 }, lineNumbersMinChars: 3, glyphMargin: false, folding: false, lineDecorationsWidth: 12, renderLineHighlight: "none", overviewRulerLanes: 0, hideCursorInOverviewRuler: true, scrollbar: { alwaysConsumeMouseWheel: false } }} />;
}
