// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { LessonEditor } from "./LessonEditor";
import { saveLearningLesson } from "@/lib/learning";
import { getLessonQuestions } from "@/lib/sectionQuestions";
import type { CourseLesson } from "@/types/courses";
import { defaultCodeConfig } from "@/features/code-exercise/config";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const t = (key: string) => key;
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "instructor" } }) }));
vi.mock("@/lib/learning", () => ({ saveLearningLesson: vi.fn() }));
vi.mock("@/lib/sectionQuestions", () => ({ getLessonQuestions: vi.fn() }));
vi.mock("@/lib/courses", () => ({ applyCourseLessonLocaleContent: (lesson: object, locale: object) => ({ ...lesson, ...locale }) }));
vi.mock("@/pages/learn/components/LessonPlayerCard", () => ({ LessonPlayerCard: () => <div>Preview</div> }));
vi.mock("@/features/code-exercise/admin/CodeExerciseBuilder", () => ({ CodeExerciseBuilder: () => null }));
vi.mock("../PracticeHackathon", () => ({ PracticeHackathonField: () => null }));
vi.mock("../PracticeProject", () => ({ PracticeProjectField: () => null }));
vi.mock("./useUnsavedLearning", () => ({ useUnsavedLearning: () => ({ state: "unblocked" }) }));
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) => open === false ? null : <div>{children}</div>, DialogContent: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper, DialogFooter: Wrapper };
});

it("focuses a translated resource error and removes it without changing master resources", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial: CourseLesson = { id: "lesson", section_id: "section", title: "Article", description_markdown: "Content", lesson_format: "article", published: true, order: 0, duration_seconds: 0, resources: [{ title: "Original resource", url: "https://example.com/original" }] };
  vi.mocked(saveLearningLesson).mockResolvedValue(initial);
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={{ en: { title: "English", resources: [{ title: "Broken link", url: "javascript:alert(1)" }] } }} isNew={false} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const click = async (label: string) => { await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === label)!.click()); };
  await click("learning.save");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  await click("learning.fixFirst");
  expect(container.querySelector("select")?.value).toBe("en");
  expect(document.activeElement?.id).toBe("learning-resource-0-url");
  await click("learning.removeResource");
  expect(container.querySelector("#learning-resource-0-url")).toBeNull();
  await click("learning.save");
  expect(saveLearningLesson).toHaveBeenCalledWith("course", expect.objectContaining({ resources: initial.resources }), undefined, expect.objectContaining({ en: expect.objectContaining({ resources: [] }) }));
});
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it("opens the master editor from translated preview and focuses each publish issue without saving", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor
    courseId="course" initial={{ id: "lesson", section_id: "section", title: "", description_markdown: "", lesson_format: "article", published: true, order: 0, duration_seconds: 0 }}
    sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={{ en: { title: "English title" } }} isNew={false} onClose={vi.fn()} onSaved={vi.fn()}
  /></QueryClientProvider>));
  const click = async (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find(button => button.textContent === label);
    expect(button).toBeDefined();
    await act(async () => button!.click());
  };
  const locale = container.querySelector("select")!;
  act(() => { locale.value = "en"; locale.dispatchEvent(new Event("change", { bubbles: true })); });
  await click("learning.preview");
  await click("learning.save");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("learning.validation.title_required");
  await click("learning.fixFirst");
  expect(locale.value).toBe("vi");
  expect(document.activeElement?.id).toBe("learning-title");
  await click("learning.validation.content_required");
  expect(document.activeElement?.id).toBe("learning-description_markdown");
});

it("opens readiness issues on a draft without publishing or saving it", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial: CourseLesson = { id: "draft", section_id: "section", title: "", description_markdown: "Content", lesson_format: "article", published: false, order: 0, duration_seconds: 0 };
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={{}} isNew={false} initialIssueCodes={["title_required"]} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  expect(container.textContent).toContain("learning.validation.title_required");
  await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "learning.fixFirst")!.click());
  expect(document.activeElement?.id).toBe("learning-title");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
});

it("preserves malformed practice until explicit reset, then saves a draft with content and translations intact", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const config = { mode: "checklist", checklist_items: {} };
  const initial = { id: "legacy", section_id: "section", title: "Legacy", description_markdown: "Keep instructions", lesson_format: "practice", published: true, order: 0, duration_seconds: 37, practice_config: config } as unknown as CourseLesson;
  const locales = { en: { title: "Translated", practice_copy: { item: { label: "Keep translation" } } } };
  vi.mocked(saveLearningLesson).mockResolvedValue(initial);
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={locales} isNew={false} initialIssueCodes={["invalid_config"]} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const button = (label: string) => Array.from(container.querySelectorAll("button")).find(item => item.textContent === label)!;
  const click = async (label: string) => { await act(async () => button(label).click()); };
  expect(button("learning.preview").disabled).toBe(true);
  await click("learning.save");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  await click("learning.resetPracticeConfig");
  expect(container.textContent).toContain("learning.invalidPracticeRecovery");
  const locale = container.querySelector("select")!;
  act(() => { locale.value = "en"; locale.dispatchEvent(new Event("change", { bubbles: true })); });
  await click("learning.editMasterConfig");
  expect(locale.value).toBe("vi");
  await click("learning.cancel");
  await click("learning.resetPracticeConfig");
  await click("learning.confirmAction");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  expect(config).toEqual({ mode: "checklist", checklist_items: {} });
  expect(button("learning.preview").disabled).toBe(false);
  await click("learning.save");
  expect(saveLearningLesson).toHaveBeenCalledWith("course", expect.objectContaining({ published: false, title: "Legacy", description_markdown: "Keep instructions", duration_seconds: 37, practice_config: { mode: "instruction" } }), undefined, locales);
});

it.each([undefined, {}])("recovers missing or malformed code config only after confirmation: %j", async config => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial = { id: "legacy-code", section_id: "section", title: "Legacy code", description_markdown: "Keep instructions", lesson_format: "code_exercise", published: true, order: 0, duration_seconds: 37, code_exercise_config: config } as unknown as CourseLesson;
  const locales = { en: { title: "Translated" } };
  vi.mocked(saveLearningLesson).mockResolvedValue(initial);
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={locales} isNew={false} initialIssueCodes={["invalid_config"]} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const button = (label: string) => Array.from(container.querySelectorAll("button")).find(item => item.textContent === label)!;
  const click = async (label: string) => { await act(async () => button(label).click()); };
  expect(button("learning.preview").disabled).toBe(true);
  await click("learning.save");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  await click("learning.fixFirst");
  expect(document.activeElement).toBe(button("learning.resetCodeConfig"));
  await click("learning.resetCodeConfig");
  expect(container.textContent).toContain("learning.invalidCodeRecovery");
  const locale = container.querySelector("select")!;
  act(() => { locale.value = "en"; locale.dispatchEvent(new Event("change", { bubbles: true })); });
  await click("learning.editMasterConfig");
  expect(locale.value).toBe("vi");
  await click("learning.cancel");
  await click("learning.resetCodeConfig");
  await click("learning.confirmAction");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  expect(initial.code_exercise_config).toBe(config);
  expect(button("learning.preview").disabled).toBe(false);
  await click("learning.save");
  expect(saveLearningLesson).toHaveBeenCalledWith("course", expect.objectContaining({ published: false, title: "Legacy code", description_markdown: "Keep instructions", duration_seconds: 37, code_exercise_config: defaultCodeConfig() }), undefined, locales);
});

it("requires confirmation to discard malformed resources and preserves valid entries and other lesson content", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); client.clear(); };
  const valid = { title: "Rust book", url: "https://doc.rust-lang.org/book/" };
  const initial: CourseLesson = { id: "lesson", section_id: "section", title: "Legacy resources", description_markdown: "Keep instructions", lesson_format: "article", published: true, duration_seconds: 37, order: 0, resources: [valid, null] as unknown as CourseLesson["resources"] };
  vi.mocked(saveLearningLesson).mockResolvedValue(initial);
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={{}} isNew={false} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const click = async (label: string) => { await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === label)!.click()); };
  expect(container.textContent).toContain("learning.invalidResourcesRecovery");
  await click("learning.recoverResources");
  expect(container.textContent).toContain("learning.invalidResourcesRecovery");
  expect(saveLearningLesson).not.toHaveBeenCalled();
  await click("learning.cancel");
  await click("learning.recoverResources");
  await click("learning.confirmAction");
  expect(container.textContent).not.toContain("learning.invalidResourcesRecovery");
  await click("learning.save");
  expect(saveLearningLesson).toHaveBeenCalledWith("course", expect.objectContaining({ published: false, title: "Legacy resources", description_markdown: "Keep instructions", duration_seconds: 37, resources: [valid] }), undefined, {});
  expect(initial.resources).toEqual([valid, null]);
});


it("opens a structured server issue in its locale and focuses its exact field", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course"
    initial={{ id: "lesson", section_id: "section", title: "Article", description_markdown: "Read", lesson_format: "article", order: 0, duration_seconds: 0 }}
    sections={[]} nextLessonOrder={1} primaryLocale="vi" locales={{ en: { title: "English", resources: [{ title: "Resource", url: "bad" }] } }} isNew={false}
    initialIssues={[{ panel: "content", lessonId: "lesson", locale: "en", field: "resource-0-url", fieldPath: ["resources", 0, "url"], code: "resource_url_invalid" }]}
    onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  expect(container.querySelector("select")?.value).toBe("en");
  expect(document.activeElement?.id).toBe("learning-resource-0-url");
  expect(saveLearningLesson).not.toHaveBeenCalled();
});


it("keeps the current draft and focuses transaction issues after a failed save", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const onClose = vi.fn();
  vi.mocked(saveLearningLesson).mockRejectedValue(Object.assign(new Error("LESSON_NOT_PUBLISHABLE: resource_url_invalid"), { details: JSON.stringify({ issues: [{ lessonId: "lesson", locale: "en", field: "resource-0-url", code: "resource_url_invalid" }] }) }));
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course"
    initial={{ id: "lesson", section_id: "section", title: "Draft preserved", description_markdown: "Read", lesson_format: "article", order: 0, duration_seconds: 0 }}
    sections={[]} nextLessonOrder={1} primaryLocale="vi" locales={{ en: { title: "English draft", resources: [{ title: "Resource", url: "https://example.com" }] } }} isNew={false}
    onClose={onClose} onSaved={vi.fn()} /></QueryClientProvider>));
  await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "learning.save")!.click());
  expect(onClose).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Draft preserved");
  await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "learning.fixFirst")!.click());
  expect(container.querySelector("select")?.value).toBe("en");
  expect(document.activeElement?.id).toBe("learning-resource-0-url");
  expect((document.activeElement as HTMLInputElement).value).toBe("https://example.com");
});

it("recovers hidden malformed code copy only after confirmation and preserves valid values until Save", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial: CourseLesson = { id: "copy", section_id: "section", title: "Code", lesson_format: "code_exercise", published: false, order: 0, duration_seconds: 37, code_exercise_config: defaultCodeConfig() };
  const locales = { en: { title: "English", code_exercise_locale: { hints: ["Keep", 42], test_copy: { test: { description: "Keep test", hint: {} } } }, subtitle_locales: ["en", "bad"] } } as never;
  const before = structuredClone(locales);
  vi.mocked(saveLearningLesson).mockResolvedValue(initial);
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={locales} isNew={false} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const click = async (label: string) => { await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === label)!.click()); };
  await click("learning.save"); expect(saveLearningLesson).not.toHaveBeenCalled();
  await click("learning.fixFirst"); expect(container.querySelector("select")?.value).toBe("en");
  await click("learning.recoverCopy"); expect(container.textContent).toContain("learning.invalidCopyRecovery");
  await click("learning.cancel");
  await click("learning.recoverCopy");
  await click("learning.confirmAction");
  expect(container.textContent).not.toContain("learning.invalidCopyRecovery");
  expect(saveLearningLesson).not.toHaveBeenCalled(); expect(locales).toEqual(before);
  await click("learning.save");
  expect(saveLearningLesson).toHaveBeenCalledWith("course", expect.objectContaining({ published: false, duration_seconds: 37, code_exercise_config: initial.code_exercise_config }), undefined, expect.objectContaining({ en: expect.objectContaining({ title: "English", code_exercise_locale: { hints: ["Keep"], test_copy: { test: { description: "Keep test" } } }, subtitle_locales: ["en"] }) }));
});

it("keeps malformed master text until confirmed recovery and saves only as a draft", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial = { id: "raw", section_id: "section", title: { raw: "bad" }, description_markdown: "Keep this content", lesson_format: "article", published: true, order: 0, duration_seconds: 37 } as unknown as CourseLesson;
  const before = structuredClone(initial);
  vi.mocked(saveLearningLesson).mockResolvedValue(initial);
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[]} nextLessonOrder={1} primaryLocale="vi" locales={{}} isNew={false} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const click = async (label: string) => { await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === label)!.click()); };
  await click("learning.save"); expect(saveLearningLesson).not.toHaveBeenCalled();
  await click("learning.recoverCopy"); expect(container.textContent).toContain("learning.invalidCopyRecovery");
  expect(initial).toEqual(before);
  await click("learning.cancel");
  await click("learning.recoverCopy");
  await click("learning.confirmAction");
  expect(saveLearningLesson).not.toHaveBeenCalled(); expect(initial).toEqual(before);
  await click("learning.save");
  expect(saveLearningLesson).toHaveBeenCalledWith("course", expect.objectContaining({ title: "", description_markdown: "Keep this content", duration_seconds: 37, published: false }), undefined, {});
});

it.each(["structured", "codes"])("focuses the actual invalid checklist input from %s issues without saving", async (source) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial: CourseLesson = { id: "lesson", section_id: "section", title: "Practice", description_markdown: "Instructions", lesson_format: "practice", order: 0, duration_seconds: 0,
    practice_config: { mode: "checklist", checklist_items: [{ id: "valid", label: "Keep me" }, { id: "invalid", label: "" }] } };
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[{ id: "section", title: "Section", order: 0 }]} nextLessonOrder={1} primaryLocale="vi" locales={{}} isNew={false}
    initialIssues={source === "structured" ? [{ lessonId: "lesson", field: "practice_config", fieldPath: ["practice_config"], code: "invalid_checklist", locale: "vi", panel: "content" }] : undefined} initialIssueCodes={source === "codes" ? ["invalid_checklist"] : undefined}
    onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  expect(document.activeElement?.id).toBe("learning-practice-checklist-1");
  expect((container.querySelector("#learning-practice-checklist-0") as HTMLInputElement).value).toBe("Keep me");
  expect(saveLearningLesson).not.toHaveBeenCalled();
});

it("retains server-only directory issues as actionable fields from readiness badges", () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); const client = new QueryClient();
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial: CourseLesson = { id: "lesson", section_id: "section", title: "Practice", description_markdown: "Instructions", lesson_format: "practice", order: 0, duration_seconds: 0, practice_config: { mode: "instruction", related_hackathon_id: "hidden" } };
  act(() => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[]} nextLessonOrder={1} primaryLocale="vi" locales={{}} isNew={false} initialIssueCodes={["invalid_related_hackathon"]} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  const issueButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "learning.validation.invalid_related_hackathon");
  expect(issueButton).toBeDefined();
  expect(saveLearningLesson).not.toHaveBeenCalled();
});

it("opens with fresh questions and preserves an active draft during background refresh", async () => {
  const question = (text: string) => ({ id: "question", question: text, type: "mcq", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct_index: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const key = ["learning-editor-questions", "course", "lesson", "instructor"];
  client.setQueryData(key, [question("Old cached question")]);
  let resolve!: (rows: Awaited<ReturnType<typeof getLessonQuestions>>) => void;
  vi.mocked(getLessonQuestions).mockReturnValue(new Promise(done => { resolve = done; }));
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  const initial: CourseLesson = { id: "lesson", section_id: "section", title: "Quiz", lesson_format: "quiz", order: 0, duration_seconds: 0 };
  await act(async () => root.render(<QueryClientProvider client={client}><LessonEditor courseId="course" initial={initial} sections={[]} nextLessonOrder={1} primaryLocale="vi" locales={{}} isNew={false} onClose={vi.fn()} onSaved={vi.fn()} /></QueryClientProvider>));
  expect(container.querySelector("#learning-question-0")).toBeNull();
  expect(container.textContent).toContain("learning.loading");
  await act(async () => { resolve([question("Fresh saved question")] as never); await new Promise(done => setTimeout(done, 10)); });
  const input = Array.from(container.querySelectorAll("input,textarea")).find(field => (field as HTMLInputElement).value === "Fresh saved question") as HTMLInputElement;
  expect(input).toBeTruthy();
  act(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!.call(input, "Unsaved author edit");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  vi.mocked(getLessonQuestions).mockResolvedValue([question("Background server update")] as never);
  await act(async () => { await client.invalidateQueries({ queryKey: key }); await new Promise(done => setTimeout(done, 10)); });
  expect(Array.from(container.querySelectorAll("input,textarea")).some(field => (field as HTMLInputElement).value === "Unsaved author edit")).toBe(true);
});
