import type { CSSProperties } from "react";

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

export const SOLIDITY_LANGS = new Set(["solidity", "sol"]);

export function codeLanguageLabel(language: string) {
  return LANG_LABELS[language] ?? (language ? language.toUpperCase() : "Code");
}

/** Prism theme driven by the semantic code tokens, so one object serves light and dark. */
export const codeSyntaxStyle: Record<string, CSSProperties> = {
  'code[class*="language-"]': { color: "var(--code-block-text)", background: "none", fontFamily: "inherit", textAlign: "left", whiteSpace: "pre", tabSize: 2 },
  'pre[class*="language-"]': { color: "var(--code-block-text)", background: "none", fontFamily: "inherit", margin: 0, overflow: "auto" },
  keyword: { color: "var(--code-syntax-keyword)" },
  function: { color: "var(--code-syntax-function)" },
  builtin: { color: "var(--code-syntax-builtin)" },
  string: { color: "var(--code-syntax-string)" },
  "attr-value": { color: "var(--code-syntax-string)" },
};
