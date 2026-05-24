import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

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
};

export function CodeBlock({ language, code }: Props) {
  const { t } = useTranslation("common");

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  const label =
    LANG_LABELS[language] ??
    (language ? language.toUpperCase() : "Code");
  const isSolidity = SOLIDITY_LANGS.has(language);

  const remixUrl = isSolidity
    ? `https://remix.ethereum.org/#code=${btoa(unescape(encodeURIComponent(code)))}`
    : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border-subtle shadow-card">
      {/* Header toolbar */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface-raised px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => void handleCopy()}
            title={t("actions.copy")}
            aria-label={t("actions.copy")}
          >
            {copied ? (
              <Check className="size-3.5 text-success" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </Button>
          {remixUrl && (
            <a href={remixUrl} target="_blank" rel="noreferrer">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1 text-[11px] font-medium"
              >
                <ExternalLink className="size-3" aria-hidden />
                {t("actions.runInRemix")}
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto bg-surface-base font-mono">
        <SyntaxHighlighter
          language={language || "text"}
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: "transparent",
            fontSize: "0.75rem",
            lineHeight: "1.5rem",
            padding: "1rem 1.25rem",
          }}
          codeTagProps={{ style: { fontFamily: "inherit" } }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
