import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFlashcardDeck } from "@/hooks/useFlashcardDeck";
import { isDueToday, type Flashcard, type FlashcardReviewAction } from "@/lib/flashcards";
import { cn } from "@/lib/utils";

type Props = {
  lessonId: string | null;
  courseId: string | null;
  completed: boolean;
  locale?: "vi" | "en";
};

type Phase = "idle" | "reviewing" | "done";

export function FlashcardDeckCard({ lessonId, courseId, completed, locale }: Props) {
  const { t } = useTranslation("courses");
  const { deck, loading, generating, error, generate, submitReview } = useFlashcardDeck({
    lessonId,
    courseId,
    locale,
  });

  const [phase, setPhase] = useState<Phase>("idle");
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const dueCards = useMemo(() => (deck?.cards ?? []).filter((c) => isDueToday(c)), [deck]);

  if (!completed || !lessonId) return null;
  if (loading) return null;

  const startReview = () => {
    if (dueCards.length === 0) return;
    setQueue(dueCards);
    setIndex(0);
    setFlipped(false);
    setReviewedCount(0);
    setPhase("reviewing");
  };

  const handleAnswer = async (action: FlashcardReviewAction) => {
    const card = queue[index];
    if (!card) return;
    await submitReview(card.id, action);
    setReviewedCount((n) => n + 1);
    if (index + 1 >= queue.length) {
      setPhase("done");
      return;
    }
    setIndex(index + 1);
    setFlipped(false);
  };

  // — No deck yet: prompt to generate —
  if (!deck) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:mx-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Layers className="mt-0.5 size-4 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("detail.learn.flashcards.title", { defaultValue: "Flashcards" })}
              </p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {t("detail.learn.flashcards.subtitle", {
                  defaultValue: "Củng cố trí nhớ bằng thẻ ghi nhớ",
                })}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => void generate()}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            <span className="ml-1">
              {generating
                ? t("detail.learn.flashcards.generating", {
                    defaultValue: "Cora đang tạo thẻ…",
                  })
                : t("detail.learn.flashcards.generateAction", {
                    defaultValue: "Tạo flashcards",
                  })}
            </span>
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    );
  }

  // — Done with a review session —
  if (phase === "done") {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 text-center sm:mx-6">
        <p className="text-sm font-semibold text-foreground">
          {t("detail.learn.flashcards.sessionDone", {
            defaultValue: "Xong! Đã ôn {{count}} thẻ.",
            count: reviewedCount,
          })}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setPhase("idle")}
        >
          {t("detail.learn.flashcards.backToOverview", {
            defaultValue: "Quay lại",
          })}
        </Button>
      </div>
    );
  }

  // — Reviewing —
  if (phase === "reviewing") {
    const card = queue[index];
    if (!card) {
      setPhase("done");
      return null;
    }
    // Sync UI strings with the deck's content locale so buttons match the cards.
    const tOpts = { lng: deck.locale } as const;
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:mx-6">
        <div className="mb-3 flex items-center justify-between text-xs text-foreground-muted">
          <span className="font-medium">
            {index + 1} / {queue.length}
          </span>
          <button
            type="button"
            aria-label={String(
              t("detail.learn.flashcards.backToOverview", {
                ...tOpts,
                defaultValue: "Quay lại",
              }),
            )}
            className="inline-flex size-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-base hover:text-foreground"
            onClick={() => setPhase("idle")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* 3D flip card */}
        <button
          type="button"
          onClick={() => setFlipped((v) => !v)}
          className="block w-full text-left [perspective:1200px]"
          aria-label={String(
            t("detail.learn.flashcards.flipHint", {
              ...tOpts,
              defaultValue: "Bấm để lật thẻ",
            }),
          )}
        >
          <div
            className={cn(
              "relative min-h-[160px] w-full transition-transform duration-500 [transform-style:preserve-3d]",
              flipped && "[transform:rotateY(180deg)]",
            )}
          >
            {/* Front face */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col rounded-xl border border-border bg-surface-base p-6",
                "[backface-visibility:hidden]",
              )}
            >
              <p className="mb-2 text-[11px] uppercase tracking-wide text-foreground-muted">
                {t("detail.learn.flashcards.frontLabel", {
                  ...tOpts,
                  defaultValue: "Câu hỏi",
                })}
              </p>
              <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-foreground">
                {card.front}
              </p>
              <p className="mt-auto pt-3 text-[11px] text-foreground-muted">
                {t("detail.learn.flashcards.flipHint", {
                  ...tOpts,
                  defaultValue: "Bấm để lật thẻ",
                })}
              </p>
            </div>

            {/* Back face */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col rounded-xl border border-primary/40 bg-surface-base p-6",
                "[backface-visibility:hidden] [transform:rotateY(180deg)]",
              )}
            >
              <p className="mb-2 text-[11px] uppercase tracking-wide text-foreground-muted">
                {t("detail.learn.flashcards.backLabel", {
                  ...tOpts,
                  defaultValue: "Đáp án",
                })}
              </p>
              <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-foreground">
                {card.back}
              </p>
            </div>
          </div>
        </button>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!flipped}
            onClick={() => void handleAnswer("again")}
          >
            {t("detail.learn.flashcards.again", { ...tOpts, defaultValue: "Lại" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!flipped}
            onClick={() => void handleAnswer("good")}
          >
            {t("detail.learn.flashcards.good", { ...tOpts, defaultValue: "Tốt" })}
          </Button>
          <Button
            size="sm"
            disabled={!flipped}
            onClick={() => void handleAnswer("easy")}
          >
            {t("detail.learn.flashcards.easy", { ...tOpts, defaultValue: "Dễ" })}
          </Button>
        </div>
      </div>
    );
  }

  // — Overview (deck exists, not reviewing) —
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:mx-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Layers className="mt-0.5 size-4 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("detail.learn.flashcards.title", { defaultValue: "Flashcards" })}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {t("detail.learn.flashcards.totalCount", {
                defaultValue: "Tổng {{count}} thẻ",
                count: deck.cards.length,
              })}
              {" · "}
              {dueCards.length > 0
                ? t("detail.learn.flashcards.dueCount", {
                    defaultValue: "{{count}} thẻ cần ôn",
                    count: dueCards.length,
                  })
                : t("detail.learn.flashcards.noDueToday", {
                    defaultValue: "Tuyệt vời! Quay lại ngày mai 🎯",
                  })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void generate({ force: true })}
            disabled={generating}
            title={String(
              t("detail.learn.flashcards.regenerateAction", { defaultValue: "Tạo lại" }),
            )}
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            size="sm"
            onClick={startReview}
            disabled={dueCards.length === 0 || generating}
          >
            {t("detail.learn.flashcards.startReview", {
              defaultValue: "Bắt đầu ôn",
            })}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
