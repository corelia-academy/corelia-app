import { expect, it } from "vitest";
import { CODE_LANGUAGES, codeLanguages, codeFileForLanguage, validCodeFile } from "./languages";
import { defaultCodeConfig, validateCodeConfig, withCodeRevision } from "./config";
import { evaluateCodeExercise } from "./evaluate";
import { isCodeConfigShape } from "./configShape";

it.each(CODE_LANGUAGES)("supports saving and publishing both modes in %s", language => {
  for (const mode of ["fill", "edit"] as const) {
    const config = defaultCodeConfig(mode, language);
    expect(isCodeConfigShape(config)).toBe(true);
    expect(validateCodeConfig(config)).toEqual([]);
    expect(validateCodeConfig(config, true)).toEqual([]);
    expect(config.language).toBe(language);
    expect(config.file.path).toBe(codeLanguages[language].path);
    const response = config.mode === "fill" ? { answers: { mutable: config.blanks[0].accepted_answers[0] } } : { source: config.reference_solution };
    expect(evaluateCodeExercise(config, response).passed).toBe(true);
    expect(evaluateCodeExercise(config, { answers: {}, source: config.file.starter_source }).passed).toBe(false);
    expect(validateCodeConfig({ ...config, file: { ...config.file, path: "../secret.txt" } })).toContain("invalid_file");
    expect(validateCodeConfig({ ...config, reference_solution: "" })).toContain("source_required");
    expect(validateCodeConfig({ ...config, reference_solution: "wrong" }, true)).toContain("solution_failed");
  }
});

it("accepts C++ extensions and rejects mismatched extensions and unsafe paths", () => {
  for (const extension of ["cpp", "cc", "cxx"]) expect(validCodeFile(`main.${extension}`, "cpp")).toBe(true);
  for (const path of ["main.rs", "main.tsx", "../main.ts", "/main.ts", "a\\main.ts", "main.ts\n"]) expect(validCodeFile(path, "typescript")).toBe(false);
  expect(codeFileForLanguage("exercise.cc", "typescript")).toBe("exercise.ts");
  expect(codeFileForLanguage("", "python")).toBe("main.py");
});

it("preserves legacy Rust defaults and invalidates drafts when language changes", () => {
  const config = defaultCodeConfig();
  expect(config.language).toBe("rust");
  expect(config.file.path).toBe("lib.rs");
  expect(config.file.starter_source).toBe("let {{blank:mutable}} count = 0;");
  expect(withCodeRevision(config, { ...config, language: "typescript" }).revision).toBe(2);
  expect(isCodeConfigShape({ ...config, language: "unsupported" })).toBe(false);
});
