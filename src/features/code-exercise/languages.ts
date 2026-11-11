export const CODE_LANGUAGES = ["rust", "typescript", "javascript", "python", "java", "c", "cpp", "go", "solidity", "move"] as const;
export type CodeLanguage = typeof CODE_LANGUAGES[number];

export const codeLanguages: Record<CodeLanguage, { label: string; extensions: readonly string[]; path: string; fill: string; answer: string; edit: string; solution: string }> = {
  rust: { label: "Rust", extensions: ["rs"], path: "lib.rs", fill: "let {{blank:mutable}} count = 0;", answer: "mut", edit: "pub fn add(a: i32, b: i32) -> i32 { 0 }", solution: "pub fn add(a: i32, b: i32) -> i32 { a + b }" },
  typescript: { label: "TypeScript", extensions: ["ts"], path: "main.ts", fill: "const count: {{blank:mutable}} = 0;", answer: "number", edit: "function add(a: number, b: number): number { return 0; }", solution: "function add(a: number, b: number): number { return a + b; }" },
  javascript: { label: "JavaScript", extensions: ["js"], path: "main.js", fill: "{{blank:mutable}} count = 0;", answer: "let", edit: "function add(a, b) { return 0; }", solution: "function add(a, b) { return a + b; }" },
  python: { label: "Python", extensions: ["py"], path: "main.py", fill: "count = {{blank:mutable}}", answer: "0", edit: "def add(a, b):\n    return 0", solution: "def add(a, b):\n    return a + b" },
  java: { label: "Java", extensions: ["java"], path: "Main.java", fill: "class Main { {{blank:mutable}} count = 0; }", answer: "int", edit: "class Main { static int add(int a, int b) { return 0; } }", solution: "class Main { static int add(int a, int b) { return a + b; } }" },
  c: { label: "C", extensions: ["c"], path: "main.c", fill: "{{blank:mutable}} count = 0;", answer: "int", edit: "int add(int a, int b) { return 0; }", solution: "int add(int a, int b) { return a + b; }" },
  cpp: { label: "C++", extensions: ["cpp", "cc", "cxx"], path: "main.cpp", fill: "{{blank:mutable}} count = 0;", answer: "int", edit: "int add(int a, int b) { return 0; }", solution: "int add(int a, int b) { return a + b; }" },
  go: { label: "Go", extensions: ["go"], path: "main.go", fill: "package main\nvar count {{blank:mutable}} = 0", answer: "int", edit: "package main\nfunc add(a int, b int) int { return 0 }", solution: "package main\nfunc add(a int, b int) int { return a + b }" },
  solidity: { label: "Solidity", extensions: ["sol"], path: "Main.sol", fill: "contract Counter { uint256 {{blank:mutable}} count = 0; }", answer: "public", edit: "function add(uint256 a, uint256 b) public pure returns (uint256) { return 0; }", solution: "function add(uint256 a, uint256 b) public pure returns (uint256) { return a + b; }" },
  move: { label: "Move", extensions: ["move"], path: "main.move", fill: "struct Counter has {{blank:mutable}} { value: u64 }", answer: "store", edit: "fun add(a: u64, b: u64): u64 { 0 }", solution: "fun add(a: u64, b: u64): u64 { a + b }" },
};

export function isCodeLanguage(value: unknown): value is CodeLanguage {
  return typeof value === "string" && CODE_LANGUAGES.some(language => language === value);
}

export function validCodeFile(path: string, language: CodeLanguage): boolean {
  return /^[\w.-]+\.[a-z]+$/.test(path) && codeLanguages[language].extensions.includes(path.split(".").at(-1) ?? "");
}

export function codeFileForLanguage(path: string, language: CodeLanguage): string {
  if (!path) return codeLanguages[language].path;
  const stem = path.replace(/\.[^.]*$/, "");
  return `${stem}.${codeLanguages[language].extensions[0]}`;
}
