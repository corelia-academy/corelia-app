import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractJson, mergeJsonPatch } from "./adapter.ts";
import { extractQueueSlugs, proposalToHandoff } from "./planner.ts";
import { normalizeStepKey, parseAgentTarget } from "./profile.ts";
import { inspectCourse } from "./state.ts";
import { evaluateEditTests, generateBoundedCombos, verifyLesson } from "./verify.ts";

test("profile: parses agent specs and normalizes step keys", () => {
  const parsed = parseAgentTarget("codex:gpt-6-luna:xhigh");
  assert.deepEqual(parsed, { provider: "codex", model: "gpt-6-luna", effort: "xhigh" });
  assert.equal(normalizeStepKey("4"), "curriculum-review");
  assert.equal(normalizeStepKey("write"), "lesson");
  assert.equal(normalizeStepKey("unknown"), null);
});

test("adapter: extracts JSON from fenced markdown and prose", () => {
  const fenced = "Here is output:\n```json\n{\"verdict\": \"pass\"}\n```\n";
  assert.deepEqual(extractJson(fenced), { verdict: "pass" });

  const prose = "Result follows: {\"a\": [1, 2], \"b\": \"ok\"} done.";
  assert.deepEqual(extractJson(prose), { a: [1, 2], b: "ok" });
});

test("adapter: merges RFC 7396 JSON patch preserving unchanged fields", () => {
  const doc = { title: "Keep", meta: { a: 1, b: 2 }, tags: ["x"] };
  const patch = { meta: { b: 9, c: null }, tags: ["y"] };
  assert.deepEqual(mergeJsonPatch(doc, patch), {
    title: "Keep",
    meta: { a: 1, b: 9 },
    tags: ["y"],
  });
  assert.deepEqual(mergeJsonPatch({ a: 1, b: 2 }, { b: null }), { a: 1 });
});

test("verify: generates bounded combinations and checks edit_tests", () => {
  const combos = generateBoundedCombos(
    [
      { id: "b1", choices: ["a", "b", "c"] },
      { id: "b2", choices: ["1", "2"] },
    ],
    4,
  );
  assert.equal(combos.length, 4);

  const ok = evaluateEditTests({
    reference_solution: "const x = computeTotal(items);",
    edit_tests: [{ name: "uses_computeTotal", expected_substring: "computeTotal" }],
  });
  assert.equal(ok?.status, "pass");
});

test("state: skips rerun in cycle count and requires verification_plan for quiz", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cm-state-"));
  try {
    const courseDir = path.join(tmp, ".course-runs", "demo");
    fs.mkdirSync(path.join(courseDir, "lessons"), { recursive: true });
    fs.mkdirSync(path.join(courseDir, "reviews"), { recursive: true });
    fs.mkdirSync(path.join(courseDir, "verification"), { recursive: true });

    fs.writeFileSync(
      path.join(courseDir, "curriculum.json"),
      JSON.stringify({
        modules: [
          {
            module_id: "M1",
            lessons: [{ lesson_id: "L1-1", title: "Quiz", type: "quiz" }],
          },
        ],
      }),
    );
    fs.writeFileSync(
      path.join(courseDir, "lessons", "L1-1.json"),
      JSON.stringify({ questions: [], verification_plan: [{ id: "v1" }] }),
    );
    fs.writeFileSync(
      path.join(courseDir, "reviews", "L1-1.json"),
      JSON.stringify({ verdict: "needs_fix", blocking_issues: ["x"] }),
    );
    fs.writeFileSync(
      path.join(courseDir, "run-log.jsonl"),
      [
        JSON.stringify({ step: 6, lesson_id: "L1-1", role: "lesson-review", action: "end", result: "needs_fix" }),
        JSON.stringify({ step: 6, lesson_id: "L1-1", role: "lesson-review", action: "end", result: "rerun" }),
      ].join("\n"),
    );

    const rep = inspectCourse(tmp, courseDir, false);
    assert.equal(rep.lessons[0]?.cycles, 1);
    assert.equal(rep.lessons[0]?.status, "chờ_kiểm_chứng");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("planner: maps backlog proposal to handoff and extracts queue slugs", () => {
  const handoff = proposalToHandoff({
    slug: "devops-core",
    title: "DevOps",
    level: "intermediate",
    promise: "CI/CD",
    final_product: "Repo",
    corelia_hook: "Cert",
    path_nodes: { path: "devops" },
    starting_point: { knowledge: "Git", requires: [] },
    modules: [{ node: "ci", mechanism: "Auto", pitfalls: ["Slow"], outcome: "Fix" }],
  });
  assert.equal(handoff.slug, "devops-core");
  assert.equal(handoff.path, "devops");
  assert.equal(handoff.is_foundation, true);
  assert.deepEqual(extractQueueSlugs({ queue: ["a", { slug: "b" }] }), ["a", "b"]);
});

test("verify: checks practice checklist_items snippets for syntax errors", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cm-verify-practice-"));
  try {
    const courseDir = path.join(tmp, ".course-runs", "demo");
    fs.mkdirSync(path.join(courseDir, "lessons"), { recursive: true });

    const writeLesson = (id: string, items: unknown[]) => {
      fs.writeFileSync(
        path.join(courseDir, "lessons", `${id}.json`),
        JSON.stringify({
          lesson_id: id,
          practice: { mode: "checklist", instructions_markdown: "Test", checklist_items: items },
        }),
      );
    };

    writeLesson("L1-1", [
      { id: "p1", title: "JS hop le", action: "Chay", expected: "OK", snippet: { language: "javascript", code: "const x = 1 + 2;" } },
      { id: "p2", title: "SQL bo qua tinh", action: "Chay", expected: "OK", snippet: { language: "sql", code: "SELECT 1;" } },
    ]);
    const okRep = verifyLesson(tmp, "demo", "L1-1", false);
    assert.equal(okRep.lesson_type, "practice");
    assert.equal(okRep.passed, true);
    assert.equal(okRep.checks.find((c) => c.id === "practice_p1_snippet")?.status, "pass");
    assert.equal(okRep.checks.find((c) => c.id === "practice_p2_snippet")?.status, "skipped");

    writeLesson("L1-2", [
      { id: "p1", title: "JS loi cu phap", action: "Chay", expected: "OK", snippet: { language: "javascript", code: "const x = ;" } },
    ]);
    const badRep = verifyLesson(tmp, "demo", "L1-2", false);
    assert.equal(badRep.passed, false);
    assert.equal(badRep.checks.find((c) => c.id === "practice_p1_snippet")?.status, "fail");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
