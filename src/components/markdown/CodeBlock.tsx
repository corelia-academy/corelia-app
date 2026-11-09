import { useEffect, useState, type ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { ArrowSquareOut, Copy as PhCopy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, string> = {
  solidity: "Solidity",
  sol: "Solidity",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  python: "Python",
  py: "Python",
  rust: "Rust",
  go: "Go",
  bash: "Bash",
  sh: "Shell",
  zsh: "Shell",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sql: "SQL",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  markdown: "Markdown",
  md: "Markdown",
  jsx: "JSX",
  tsx: "TSX",
  graphql: "GraphQL",
  gql: "GraphQL",
  cpp: "C++",
  c: "C",
  java: "Java",
  swift: "Swift",
  kotlin: "Kotlin",
  ruby: "Ruby",
  rb: "Ruby",
  php: "PHP",
};

const SOLIDITY_LANGS = new Set(["solidity", "sol"]);

type Props = {
  language: string;
  code: string;
  /** Show the copy button in the header. Turn it off where copying defeats the purpose, such as exercises. */
  copyable?: boolean;
  /** Show the header bar with the language label. Without it the actions float in the top-right corner. */
  header?: boolean;
};

const lessonDarkStyle: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': { color: "#dee2ec", background: "none", fontFamily: "inherit", textAlign: "left", whiteSpace: "pre", tabSize: 2 },
  'pre[class*="language-"]': { color: "#dee2ec", background: "none", fontFamily: "inherit", margin: 0, overflow: "auto" },
  keyword: { color: "#ff8787" },
  function: { color: "#1ebfff" },
  builtin: { color: "#ffa159" },
  string: { color: "#2fe921" },
  "attr-value": { color: "#2fe921" },
};

// Hover and press tints come from the text colour, so they stay visible on the header and body in both themes.
const CODE_ACTION_CLASS = "hover:bg-foreground/10 active:bg-foreground/15";

function codeLanguageLabel(language: string) {
  return LANG_LABELS[language] ?? (language ? language.toUpperCase() : "Code");
}

export function CodeCopyButton({ text }: { text: string }) {
  const { t } = useTranslation("common");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("actions.copied"), { position: "top-right" });
    } catch {
      toast.error(t("actions.copyFailed"), { position: "top-right" });
    }
  }

  return (
    <Button type="button" variant="cta" hierarchy="tertiary" iconOnly size="small" className={CODE_ACTION_CLASS}
      onClick={() => void handleCopy()} title={t("actions.copy")} aria-label={t("actions.copy")}>
      <PhCopy weight="duotone" className="size-5" aria-hidden />
    </Button>
  );
}

/** The shared shell of every code block: a header with the language label and optional actions, then the body. */
export function CodeBlockFrame({ language, header = true, actions, className, children }: { language: string; header?: boolean; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div data-slot="code-block" className={cn("relative overflow-hidden rounded-xl bg-code-block-surface font-mono", className)}>
      {header ? (
        <div className="relative bg-code-block-header-surface p-lg font-body">
          <p className="text-body-medium font-medium text-foreground">{codeLanguageLabel(language)}</p>
          <div className="absolute right-xs top-1/2 flex -translate-y-1/2 items-center gap-xs">{actions}</div>
        </div>
      ) : (
        <div className="absolute right-xs top-xs z-10 flex items-center gap-xs font-body">{actions}</div>
      )}
      {children}
    </div>
  );
}

function useDarkClass() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/** Inline syntax-highlighted code that inherits the font and sizing of its parent, for code that is not one plain block. */
export function CodeSpan({ code, language }: { code: string; language: string }) {
  const isDark = useDarkClass();
  return (
    <SyntaxHighlighter PreTag="span" CodeTag="span" language={language || "text"} style={isDark ? lessonDarkStyle : oneLight}
      customStyle={{ margin: 0, padding: 0, background: "transparent", fontSize: "inherit", lineHeight: "inherit", overflow: "visible", display: "inline" }}
      codeTagProps={{ style: { fontFamily: "inherit", whiteSpace: "pre" } }}>
      {code}
    </SyntaxHighlighter>
  );
}

export function CodeBlock({ language, code, copyable = true, header = true }: Props) {
  const { t } = useTranslation("common");

  const isDark = useDarkClass();

  const remixUrl = SOLIDITY_LANGS.has(language)
    ? `https://remix.ethereum.org/#code=${btoa(unescape(encodeURIComponent(code)))}`
    : null;

  return (
    <CodeBlockFrame
      language={language}
      header={header}
      actions={
        <>
          {remixUrl && (
            <Button type="button" variant="cta" hierarchy="tertiary" size="small" className={CODE_ACTION_CLASS}
              render={<a href={remixUrl} target="_blank" rel="noreferrer" />} nativeButton={false}>
              <ArrowSquareOut weight="duotone" aria-hidden />{t("actions.runInRemix")}
            </Button>
          )}
          {copyable && <CodeCopyButton text={code} />}
        </>
      }
    >
      <SyntaxHighlighter className="scrollbar-design" tabIndex={0} language={language || "text"}
        showLineNumbers lineNumberStyle={{ minWidth: "2.5rem", paddingRight: "1rem", textAlign: "right", userSelect: "none", color: isDark ? "#596587" : undefined }}
        style={isDark ? lessonDarkStyle : oneLight}
        customStyle={{ margin: 0, borderRadius: 0, background: "transparent", fontSize: "1rem", lineHeight: "2rem", letterSpacing: "-0.01em", padding: "1.25rem 1.5rem" }}
        codeTagProps={{ style: { fontFamily: "inherit" } }} wrapLongLines={false}>
        {code}
      </SyntaxHighlighter>
    </CodeBlockFrame>
  );
}
