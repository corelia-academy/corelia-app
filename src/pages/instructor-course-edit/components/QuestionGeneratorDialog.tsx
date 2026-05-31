import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, ChevronDown, ChevronUp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invokeGenerateQuestions, type GeneratedQuestionSource } from "@/lib/questionGenerator";
import { getSectionQuestions, setSectionQuestions, getLessonQuestions, setLessonQuestions } from "@/lib/sectionQuestions";
import type { SectionQuestionData, QuestionOption } from "@/types/questions";
import type { CourseSection, SupportedCourseLocale } from "@/types/courses";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type DraftQuestion = SectionQuestionData & {
  _key: string;
};

const OPTION_IDS = ["a", "b", "c", "d"] as const;
const COUNT_OPTIONS = [3, 5, 7, 10] as const;

function makeBlankQuestion(): DraftQuestion {
  return {
    _key: crypto.randomUUID(),
    type: "mcq",
    question: "",
    options: OPTION_IDS.map((id) => ({ id, text: "" })),
    correct_index: 0,
    explanation: "",
  };
}

function dataToDraft(q: SectionQuestionData): DraftQuestion {
  const opts = OPTION_IDS.map((id, i) => ({
    id,
    text: q.options[i]?.text ?? "",
  }));
  return { ...q, options: opts, _key: crypto.randomUUID() };
}

type QuestionEditorProps = {
  question: DraftQuestion;
  index: number;
  onChange: (updated: DraftQuestion) => void;
  onDelete: () => void;
};

function QuestionEditor({ question, index, onChange, onDelete }: QuestionEditorProps) {
  const [showExplanation, setShowExplanation] = useState(!!question.explanation);

  function setField<K extends keyof DraftQuestion>(key: K, value: DraftQuestion[K]) {
    onChange({ ...question, [key]: value });
  }

  function setOptionText(optIndex: number, text: string) {
    const opts = question.options.map((o, i) =>
      i === optIndex ? { ...o, text } : o,
    ) as QuestionOption[];
    onChange({ ...question, options: opts });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="shrink-0 mt-0.5 inline-flex items-center rounded border border-border-subtle px-2 py-0.5 text-xs font-medium text-foreground-muted">
          Câu {index + 1}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-foreground-muted hover:text-destructive transition-colors"
          aria-label="Xoá câu hỏi"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <textarea
        placeholder="Nội dung câu hỏi..."
        value={question.question}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("question", e.target.value)}
        rows={2}
        className="w-full resize-none rounded border border-border bg-surface-base px-3 py-2 text-sm leading-5 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
      />

      <div className="space-y-2">
        {question.options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question._key}`}
              value={String(i)}
              checked={question.correct_index === i}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setField("correct_index", parseInt(e.target.value, 10))
              }
              className="shrink-0 accent-primary"
              id={`${question._key}-opt-${i}`}
              aria-label={`Đáp án ${opt.id.toUpperCase()} là đúng`}
            />
            <span className="shrink-0 w-5 text-xs font-medium text-foreground-muted uppercase">
              {opt.id}
            </span>
            <Input
              value={opt.text}
              onChange={(e) => setOptionText(i, e.target.value)}
              placeholder={`Lựa chọn ${opt.id.toUpperCase()}...`}
              className="h-8 text-sm flex-1"
            />
          </div>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowExplanation((prev) => !prev)}
          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          {showExplanation ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
          Giải thích đáp án
        </button>
        {showExplanation && (
          <textarea
            placeholder="Giải thích vì sao đáp án đúng (tuỳ chọn)..."
            value={question.explanation ?? ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("explanation", e.target.value)}
            rows={2}
            className="mt-2 w-full resize-none rounded border border-border bg-surface-base px-3 py-2 text-sm leading-5 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        )}
      </div>
    </div>
  );
}

type SourceLesson = { id: string; title: string; hasSourceContent?: boolean };

type Props = {
  open: boolean;
  section: CourseSection | null;
  courseId: string;
  locale: SupportedCourseLocale;
  onOpenChange: (open: boolean) => void;
  /** When set to "lesson", uses lessonId-scoped questions instead of sectionId-scoped */
  mode?: "section" | "lesson";
  lessonId?: string | null;
  lessonTitle?: string | null;
  /** Other lessons in the same section, for source selection */
  sectionLessons?: SourceLesson[];
};

export function QuestionGeneratorDialog({
  open,
  section,
  courseId,
  locale,
  onOpenChange,
  mode = "section",
  lessonId,
  lessonTitle,
  sectionLessons = [],
}: Props) {
  const { t } = useTranslation("instructor");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [sources, setSources] = useState<GeneratedQuestionSource[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [count, setCount] = useState<number>(5);
  // Lesson mode: which source lessons are selected for generation
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const listEndRef = useRef<HTMLDivElement>(null);

  const isLessonMode = mode === "lesson";

  // Load existing questions when dialog opens
  useEffect(() => {
    if (!open || !courseId) return;
    if (isLessonMode && !lessonId) return;
    if (!isLessonMode && !section) return;

    setLoading(true);
    setGenerateError(null);

    const loadPromise = isLessonMode
      ? getLessonQuestions(courseId, lessonId!, locale)
      : getSectionQuestions(courseId, section!.id, locale);

    loadPromise
      .then((existing) => {
        setQuestions(existing.map(dataToDraft));
      })
      .catch(() => {
        setQuestions([]);
      })
      .finally(() => setLoading(false));

    if (isLessonMode && lessonId) {
      const currentIndex = sectionLessons.findIndex((l) => l.id === lessonId);
      const contentSources = sectionLessons.filter(
        (l) => l.id !== lessonId && l.hasSourceContent !== false,
      );
      const priorContentSources =
        currentIndex > 0
          ? sectionLessons
              .slice(0, currentIndex)
              .filter((l) => l.hasSourceContent !== false)
          : [];
      const current = sectionLessons.find((l) => l.id === lessonId);
      const defaults =
        priorContentSources.length > 0
          ? priorContentSources
          : contentSources.length > 0
            ? contentSources
            : current && current.hasSourceContent !== false
              ? [current]
              : [];
      setSelectedSourceIds(new Set(defaults.map((l) => l.id)));
    }
  }, [open, section, courseId, isLessonMode, lessonId, sectionLessons]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuestions([]);
      setSources([]);
      setGenerateError(null);
      setGenerating(false);
      setSaving(false);
      setSelectedSourceIds(new Set());
    }
  }, [open]);

  async function handleGenerate() {
    if (!courseId) return;
    if (!isLessonMode && !section) return;
    if (isLessonMode && !lessonId) return;

    setGenerating(true);
    setGenerateError(null);
    try {
      const req = isLessonMode
        ? {
            courseId,
            lessonId: lessonId!,
            sourceLessonIds: selectedSourceIds.size > 0 ? Array.from(selectedSourceIds) : undefined,
            locale,
            count,
          }
        : { courseId, sectionId: section!.id, locale, count };

      const res = await invokeGenerateQuestions(req);
      setSources(res.sources);
      setQuestions(res.questions.map(dataToDraft));
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : t("courseEdit.questions.generateFailed"),
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!courseId) return;
    if (!isLessonMode && !section) return;
    if (isLessonMode && !lessonId) return;

    const invalid = questions.find(
      (q) => !q.question.trim() || q.options.filter((o) => o.text.trim()).length < 2,
    );
    if (invalid) {
      toast.error(t("courseEdit.questions.fillRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload: SectionQuestionData[] = questions.map((q) => ({
        type: q.type,
        question: q.question.trim(),
        options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
        correct_index: q.correct_index,
        explanation: q.explanation?.trim() || undefined,
        locale,
      }));

      if (isLessonMode) {
        await setLessonQuestions(courseId, lessonId!, payload, locale);
        toast.success(t("courseEdit.questions.savedLesson", { count: questions.length }));
      } else {
        await setSectionQuestions(courseId, section!.id, payload, locale);
        toast.success(t("courseEdit.questions.savedSection", { count: questions.length }));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courseEdit.questions.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function updateQuestion(index: number, updated: DraftQuestion) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)));
  }

  function deleteQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankQuestion() {
    setQuestions((prev) => [...prev, makeBlankQuestion()]);
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const dialogTitle = isLessonMode
    ? t("courseEdit.questions.lessonTitle", { title: lessonTitle ?? "" })
    : t("courseEdit.questions.sectionTitle", { title: section?.title ?? "" });

  const dialogDescription = isLessonMode
    ? t("courseEdit.questions.lessonDescription")
    : t("courseEdit.questions.sectionDescription");

  function toggleSourceLesson(id: string) {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border-subtle shrink-0">
          <DialogTitle className="text-base">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: controls + sources */}
          <div className="w-64 shrink-0 border-r border-border-subtle overflow-y-auto p-4 space-y-4">
            {/* Source lesson selector (lesson mode only) */}
            {isLessonMode && sectionLessons.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
                  {t("courseEdit.questions.sourceLessons")}
                </p>
                <ul className="space-y-1">
                  {sectionLessons.map((l) => (
                    <li key={l.id}>
                      <label className="flex items-start gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedSourceIds.has(l.id)}
                          onChange={() => toggleSourceLesson(l.id)}
                          className="mt-0.5 rounded border-border accent-primary"
                        />
                        <span className={cn(
                          "text-xs leading-relaxed",
                          l.id === lessonId ? "text-foreground font-medium" : "text-foreground-muted",
                        )}>
                          {l.title}
                          {l.id === lessonId && (
                            <span className="ml-1 text-[10px] text-foreground-subtle">
                              ({t("courseEdit.questions.currentLesson")})
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
                {t("courseEdit.questions.count")}
              </p>
              <div className="flex gap-1 flex-wrap">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={cn(
                      "px-2.5 py-1 rounded text-sm border transition-colors",
                      count === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border-subtle text-foreground hover:bg-surface-raised",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={generating || loading || (isLessonMode && selectedSourceIds.size === 0)}
              onClick={handleGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                  {t("courseEdit.questions.generating")}
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" aria-hidden />
                  {t("courseEdit.questions.generate")}
                </>
              )}
            </Button>

            {generateError && (
              <p className="text-xs text-destructive">{generateError}</p>
            )}

            {sources.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
                  {t("courseEdit.questions.sources")}
                </p>
                <ul className="space-y-1">
                  {sources.map((s) => (
                    <li key={s.lessonId} className="text-xs text-foreground-muted leading-relaxed">
                      <span className="text-foreground font-medium">{s.lessonTitle}</span>
                      {s.snippet && (
                        <span className="block text-foreground-subtle mt-0.5 line-clamp-2">
                          {s.snippet}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right panel: question editor list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-foreground-muted py-4">
                <Loader2 className="size-4 animate-spin" />
                {t("courseEdit.questions.loading")}
              </div>
            )}

            {!loading && questions.length === 0 && (
              <p className="text-sm text-foreground-muted py-4 text-center">
                {t("courseEdit.questions.empty")}
              </p>
            )}

            {questions.map((q, i) => (
              <QuestionEditor
                key={q._key}
                question={q}
                index={i}
                onChange={(updated) => updateQuestion(i, updated)}
                onDelete={() => deleteQuestion(i)}
              />
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addBlankQuestion}
            >
              <Plus className="size-4 mr-1.5" aria-hidden />
              {t("courseEdit.questions.add")}
            </Button>

            <div ref={listEndRef} />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border-subtle shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("courseEdit.questions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={questions.length === 0 || saving || generating}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                {t("courseEdit.questions.saving")}
              </>
            ) : (
              t("courseEdit.questions.saveCount", { count: questions.length })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
