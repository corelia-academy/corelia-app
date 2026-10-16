import { describe, expect, it } from "vitest";
import type { CourseLesson } from "@/types/courses";
import {
  ASK_AI_URL_CONTENT_LIMIT,
  buildAskAiPrompt,
  lessonBodyForAi,
  canAskAboutLesson,
  resolveAskAiAction,
} from "./askAi";

const lesson = (patch: Partial<CourseLesson>) => ({ id: "l1", title: "Intro", ...patch }) as CourseLesson;

describe("canAskAboutLesson", () => {
  it("allows teaching formats and rejects assessments", () => {
    expect(canAskAboutLesson(lesson({ lesson_format: "article" }))).toBe(true);
    expect(canAskAboutLesson(lesson({ lesson_format: "video", youtube_url: "https://youtu.be/x" }))).toBe(true);
    expect(canAskAboutLesson(lesson({ lesson_format: "quiz" }))).toBe(false);
    expect(canAskAboutLesson(lesson({ lesson_format: "practice" }))).toBe(true);
    expect(canAskAboutLesson(null)).toBe(false);
  });
});

describe("lessonBodyForAi", () => {
  it("adds checklist and guided project steps for practice lessons", () => {
    const checklist = lesson({ lesson_format: "practice", description_markdown: "Do it", practice_config: { mode: "checklist", checklist_items: [{ id: "a", label: "Install CLI" }] } } as Partial<CourseLesson>);
    expect(lessonBodyForAi(checklist)).toBe("Do it\n\n- Install CLI");
    const guided = lesson({ lesson_format: "practice", practice_config: { mode: "guided_project", project_steps: [{ id: "b", order: 2, title: "Deploy", instructions_markdown: "" }, { id: "a", order: 1, title: "Init", instructions_markdown: "Run init" }] } } as Partial<CourseLesson>);
    expect(lessonBodyForAi(guided)).toBe("1. Init\nRun init\n2. Deploy");
  });
});

describe("buildAskAiPrompt", () => {
  it("includes titles and truncates long content", () => {
    const prompt = buildAskAiPrompt({ courseTitle: "Web3", lessonTitle: "Intro", content: "x".repeat(50) }, 10);
    expect(prompt).toContain("Course: Web3");
    expect(prompt).toContain("Lesson: Intro");
    expect(prompt).toContain(`${"x".repeat(10)}…`);
    expect(prompt).not.toContain("x".repeat(11));
  });
});

describe("resolveAskAiAction", () => {
  const input = { lessonTitle: "Intro", content: "a".repeat(ASK_AI_URL_CONTENT_LIMIT + 500) };

  it("prefills ChatGPT and Claude through the URL", () => {
    const chatgpt = resolveAskAiAction("chatgpt", input);
    const claude = resolveAskAiAction("claude", input);
    expect(chatgpt).toMatchObject({ kind: "open" });
    expect(chatgpt.kind === "open" && chatgpt.url.startsWith("https://chatgpt.com/?q=")).toBe(true);
    expect(claude.kind === "open" && claude.url.startsWith("https://claude.ai/new?q=")).toBe(true);
  });

  it("copies the prompt for Gemini because it cannot be prefilled", () => {
    const action = resolveAskAiAction("gemini", input);
    expect(action.kind).toBe("copy-and-open");
    expect(action.kind === "copy-and-open" && action.text).toContain("Lesson: Intro");
  });

  it("gives the clipboard a longer excerpt than the URL", () => {
    const copy = resolveAskAiAction("copy", input);
    const open = resolveAskAiAction("claude", input);
    expect(copy.kind === "copy" && copy.text.length).toBeGreaterThan(
      decodeURIComponent(open.kind === "open" ? open.url.split("?q=")[1] : "").length,
    );
  });
});
