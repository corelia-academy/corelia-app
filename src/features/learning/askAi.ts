import { lessonText } from "@/features/learning/lessonCopy";
import { getLessonFormat } from "@/lib/lessonFormat";
import type { CourseLesson } from "@/types/courses";

export type AskAiTarget = "chatgpt" | "claude" | "gemini" | "copy";

/** Lesson formats whose body is teaching material. Quizzes and the final assignment are assessments and never leave the app; practice has no answer key. */
const ASKABLE_FORMATS = new Set(["article", "video", "code_exercise", "practice"]);

/** Prefilled URLs have practical length limits, so they carry a shorter excerpt than the clipboard. */
export const ASK_AI_URL_CONTENT_LIMIT = 1500;
export const ASK_AI_CLIPBOARD_CONTENT_LIMIT = 6000;

const TARGET_URLS: Record<Exclude<AskAiTarget, "copy">, string> = {
  chatgpt: "https://chatgpt.com/?q=",
  claude: "https://claude.ai/new?q=",
  // Gemini has no supported prompt-prefill parameter: the prompt is copied and the app is opened.
  gemini: "https://gemini.google.com/app",
};

function practiceStepsForAi(lesson: CourseLesson): string {
  const config = lesson.practice_config;
  if (!config) return "";
  if (config.mode === "checklist") {
    return (config.checklist_items ?? []).map(item => `- ${lessonText(item.label)}`).join("\n");
  }
  if (config.mode === "guided_project") {
    return [...config.project_steps ?? []]
      .sort((a, b) => a.order - b.order)
      .map((step, i) => [`${i + 1}. ${lessonText(step.title)}`, lessonText(step.instructions_markdown).trim()].filter(Boolean).join("\n"))
      .join("\n");
  }
  return "";
}

export function lessonBodyForAi(lesson: CourseLesson): string {
  const format = getLessonFormat(lesson);
  const body = format === "code_exercise"
    ? lesson.code_exercise_locale?.instructions ?? lesson.description_markdown
    : lesson.description_markdown;
  const text = lessonText(body).trim();
  if (format !== "practice") return text;
  return [text, practiceStepsForAi(lesson)].filter(Boolean).join("\n\n");
}

export function canAskAboutLesson(lesson: CourseLesson | null): lesson is CourseLesson {
  return !!lesson && ASKABLE_FORMATS.has(getLessonFormat(lesson)) && !!lessonText(lesson.title).trim();
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}

export function buildAskAiPrompt(
  input: { courseTitle?: string | null; lessonTitle: string; content: string },
  contentLimit: number,
): string {
  const lines = [
    "I'm studying this lesson and want help understanding it. Reply in the same language as the lesson.",
    "",
    ...(input.courseTitle?.trim() ? [`Course: ${input.courseTitle.trim()}`] : []),
    `Lesson: ${input.lessonTitle.trim()}`,
  ];
  const content = truncate(input.content.trim(), contentLimit);
  if (content) lines.push("", "Lesson content:", content);
  lines.push("", "Please explain the key ideas simply, then ask me one question to check my understanding.");
  return lines.join("\n");
}

export type AskAiAction =
  | { kind: "open"; url: string }
  | { kind: "copy-and-open"; text: string; url: string }
  | { kind: "copy"; text: string };

export function resolveAskAiAction(
  target: AskAiTarget,
  input: { courseTitle?: string | null; lessonTitle: string; content: string },
): AskAiAction {
  if (target === "copy") return { kind: "copy", text: buildAskAiPrompt(input, ASK_AI_CLIPBOARD_CONTENT_LIMIT) };
  if (target === "gemini") {
    return { kind: "copy-and-open", text: buildAskAiPrompt(input, ASK_AI_CLIPBOARD_CONTENT_LIMIT), url: TARGET_URLS.gemini };
  }
  return { kind: "open", url: `${TARGET_URLS[target]}${encodeURIComponent(buildAskAiPrompt(input, ASK_AI_URL_CONTENT_LIMIT))}` };
}
