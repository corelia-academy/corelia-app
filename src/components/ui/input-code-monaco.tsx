import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/rust/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/java/register";
import "monaco-editor/languages/definitions/cpp/register";
import "monaco-editor/languages/definitions/go/register";
import "monaco-editor/editor/contrib/placeholderText/browser/placeholderText.contribution";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { Warning } from "@phosphor-icons/react";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const THEME = "corelia-input-code";
// Figma Input Code: 16px text on a 32px line, 12px vertical padding, at least six lines tall.
const LINE_HEIGHT = 32;
const PADDING_Y = 12;
const MIN_LINES = 6;
const MAX_HEIGHT = 520;

const hex = (value: string) => value.trim().replace(/^#/, "");

// Monaco cannot read CSS variables, so resolve the semantic tokens whenever the theme changes.
// The theme is global to every editor, so per-state looks (wrong line, disabled text) are CSS in globals.css.
function applyTheme() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name: string) => css.getPropertyValue(name).trim();
  monaco.editor.defineTheme(THEME, {
    base: root.classList.contains("dark") ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: hex(token("--code-syntax-keyword")) },
      { token: "string", foreground: hex(token("--code-syntax-string")) },
      { token: "number", foreground: hex(token("--code-syntax-builtin")) },
      { token: "type", foreground: hex(token("--code-syntax-function")) },
      { token: "comment", foreground: hex(token("--code-block-line-number")) },
    ],
    colors: {
      "editor.background": "#00000000",
      "editorGutter.background": "#00000000",
      "editor.foreground": token("--foreground"),
      "editorLineNumber.foreground": token("--code-block-line-number"),
      // The current line number turns bright only while the editor has focus (see globals.css).
      "editorLineNumber.activeForeground": token("--code-block-line-number"),
      "editor.lineHighlightBackground": token("--input-code-line-highlight"),
      "editor.lineHighlightBorder": "#00000000",
      "editorCursor.foreground": token("--foreground"),
      "editor.placeholder.foreground": token("--foreground-subtle"),
    },
  });
  monaco.editor.setTheme(THEME);
}

type InputCodeMonacoProps = {
  value: string;
  onChange(value: string): void;
  language: string;
  placeholder?: string;
  readOnly?: boolean;
  /** 1-based lines to mark as wrong. */
  errorLines?: number[];
  ariaLabel?: string;
  onFocusChange?(focused: boolean): void;
};

export default function InputCodeMonaco({ value, onChange, language, placeholder, readOnly = false, errorLines, ariaLabel, onFocusChange }: InputCodeMonacoProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [tops, setTops] = useState<number[]>([]);
  const key = (errorLines ?? []).join(",");

  const measure = useCallback(() => {
    const editor = editorRef.current;
    const wrong = key ? key.split(",").map(Number) : [];
    setTops(editor ? wrong.map(line => editor.getTopForLineNumber(line) - editor.getScrollTop()) : []);
  }, [key]);
  const measureRef = useRef(measure);
  useEffect(() => { measureRef.current = measure; }, [measure]);

  useEffect(() => {
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // The wrong line is a whole-line decoration (band + red number); the warning icon is overlaid at the right edge.
  useEffect(() => {
    if (!ready) return;
    const wrong = key ? key.split(",").map(Number) : [];
    decorationsRef.current?.set(wrong.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: "input-code-error-line", lineNumberClassName: "input-code-error-number" },
    })));
    // Measure after the editor has laid out the new text, outside the effect body.
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [ready, key, value, measure]);

  useEffect(() => {
    if (readOnly) {
      if (editorRef.current?.hasWidgetFocus()) {
        (document.activeElement as HTMLElement)?.blur?.();
      }
      onFocusChange?.(false);
    }
  }, [readOnly, onFocusChange]);

  const height = Math.min(MAX_HEIGHT, Math.max(MIN_LINES * LINE_HEIGHT + PADDING_Y * 2, value.split("\n").length * LINE_HEIGHT + PADDING_Y * 2));

  return (
    <div className="relative">
      <Editor height={`${height}px`} language={language} value={value} onChange={next => onChange(next ?? "")} theme={THEME} beforeMount={applyTheme}
        onMount={editor => {
          editorRef.current = editor;
          decorationsRef.current = editor.createDecorationsCollection();
          editor.onDidFocusEditorWidget(() => onFocusChange?.(true));
          editor.onDidBlurEditorWidget(() => onFocusChange?.(false));
          editor.onDidScrollChange(() => measureRef.current());
          setReady(true);
        }}
        options={{
          readOnly, domReadOnly: readOnly, placeholder, ariaLabel, minimap: { enabled: false }, fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace', fontSize: 16, letterSpacing: -0.16,
          lineHeight: LINE_HEIGHT, tabSize: 4, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: "on", accessibilitySupport: "on",
          padding: { top: PADDING_Y, bottom: PADDING_Y }, lineNumbers: "on", lineNumbersMinChars: 1, glyphMargin: false, folding: false, lineDecorationsWidth: 20,
          renderLineHighlight: readOnly ? "none" : "line", renderLineHighlightOnlyWhenFocus: true, overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
          scrollbar: { alwaysConsumeMouseWheel: false },
        }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {tops.map((top, index) => <Warning key={index} className="absolute right-lg size-4 text-input-field-error" style={{ top: top + (LINE_HEIGHT - 16) / 2 }} />)}
      </div>
    </div>
  );
}
