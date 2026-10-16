import type { CodeLanguage } from "./languages";
import { Component, lazy, Suspense, type ReactNode } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
const Monaco = lazy(() => import("./CodeExerciseEdit"));
class EditorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function CodeEditor({ source, onChange, language = "rust", readOnly = false }: { source: string; language?: CodeLanguage; onChange(value: string): void; readOnly?: boolean }) {
  const { t } = useLearningTranslation();
  const fallback = <textarea aria-label={t("learning.source")} value={source} readOnly={readOnly} onChange={e => onChange(e.target.value)} spellCheck={false} className="min-h-80 w-full bg-surface-base p-4 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20" />;
  return <EditorBoundary fallback={fallback}><Suspense fallback={fallback}><Monaco language={language} source={source} onChange={onChange} readOnly={readOnly} /></Suspense></EditorBoundary>;
}
