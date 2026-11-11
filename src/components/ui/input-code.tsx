import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { codeLanguageLabel } from "./code-syntax";

const Monaco = lazy(() => import("./input-code-monaco"));

class EditorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export type InputCodeStatus = "default" | "filled" | "focused" | "disabled" | "error";

export type InputCodeProps = {
  value: string;
  onChange(value: string): void;
  /** Language id (for example "rust"); sets the highlighting and the header label. */
  language: string;
  /** Hint shown while the editor is empty. */
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** 1-based lines to mark as wrong. Each wrong line turns red from edge to edge. */
  errorLines?: number[];
  ariaLabel?: string;
  className?: string;
};

/** The coding area where a learner types: language header, line numbers, highlighted current line, and wrong-line marking. */
export function InputCode({ value, onChange, language, placeholder, disabled = false, readOnly = false, errorLines, ariaLabel, className }: InputCodeProps) {
  const [focused, setFocused] = useState(false);
  const wrong = errorLines?.length ? errorLines : undefined;
  const status: InputCodeStatus = disabled ? "disabled" : wrong ? "error" : focused ? "focused" : value ? "filled" : "default";

  // Shown while Monaco loads or when it fails to load; it keeps the same states but has no line numbers.
  const fallback = (
    <textarea aria-label={ariaLabel} value={value} readOnly={disabled || readOnly} placeholder={placeholder} spellCheck={false}
      onChange={event => onChange(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      className={cn("block min-h-[216px] w-full resize-none bg-transparent px-2xl py-lg font-mono text-[16px] leading-8 tracking-[-0.01em] text-foreground outline-none placeholder:text-foreground-subtle", (disabled || readOnly) && "caret-transparent")} />
  );

  return (
    <div data-slot="input-code" data-status={status} data-readonly={readOnly || undefined}
      className={cn(
        "relative rounded-xl bg-input-code-surface font-mono text-foreground",
        !disabled && !readOnly && !wrong && "focus-within:ring-2 focus-within:ring-input-code-focus",
        disabled && "cursor-not-allowed bg-input-field-disabled-surface",
        className
      )}>
      {disabled && <div aria-hidden="true" className="absolute inset-0 z-10 cursor-not-allowed select-none" />}
      <div className="overflow-hidden rounded-xl border border-stroke-divider">
        <div className="bg-code-block-header-surface p-lg font-body">
          <p className="text-body-medium font-medium text-foreground">{codeLanguageLabel(language)}</p>
        </div>
        <EditorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <div className={cn("pl-2xl", (disabled || readOnly) && "pointer-events-none select-none")}>
              <Monaco value={value} onChange={onChange} language={language} placeholder={placeholder} readOnly={disabled || readOnly} disabled={disabled} errorLines={wrong} ariaLabel={ariaLabel} onFocusChange={setFocused} />
            </div>
          </Suspense>
        </EditorBoundary>
      </div>
    </div>
  );
}
