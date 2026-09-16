import { useState } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RevertCourseCompletionMode } from "@/lib/courses";
import { cn } from "@/lib/utils";

export interface RevertCourseCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: RevertCourseCompletionMode) => Promise<void>;
  certificateIssued?: boolean;
}

export function RevertCourseCompletionDialog({
  open,
  onOpenChange,
  onConfirm,
  certificateIssued = false,
}: RevertCourseCompletionDialogProps) {
  const { t } = useTranslation("courses");
  const [mode, setMode] = useState<RevertCourseCompletionMode>("last_lesson");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(mode);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("detail.learn.completion.revertError", {
              defaultValue: "Không thể hoàn tác tiến độ lúc này.",
            }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-md gap-5 sm:max-w-lg">
        <DialogHeader className="space-y-0 text-left">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <RotateCcw className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-heading-small font-display text-foreground">
                {t("detail.learn.completion.revertDialogTitle", {
                  defaultValue: "Hoàn tác trạng thái hoàn thành khóa học",
                })}
              </DialogTitle>
              <DialogDescription className="text-body-small leading-relaxed text-foreground-muted">
                {t("detail.learn.completion.revertDialogDescription", {
                  defaultValue:
                    "Chọn hình thức hoàn tác để đưa khóa học trở lại trạng thái đang học.",
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={mode}
            onValueChange={(val) => setMode(val as RevertCourseCompletionMode)}
            className="flex flex-col gap-2.5"
          >
            {/* Option 1: last_lesson (Recommended) */}
            <div
              role="radio"
              aria-checked={mode === "last_lesson"}
              tabIndex={0}
              onClick={() => setMode("last_lesson")}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setMode("last_lesson");
                }
              }}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-all duration-150 outline-none",
                mode === "last_lesson"
                  ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised",
              )}
            >
              <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border group-hover:border-border-strong">
                {mode === "last_lesson" && (
                  <div className="size-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t("detail.learn.completion.revertLastLessonTitle", {
                      defaultValue: "Hoàn tác bài học gần nhất",
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground-muted">
                  {t("detail.learn.completion.revertLastLessonDesc", {
                    defaultValue:
                      "Khóa học sẽ trở về trạng thái đang học với tiến độ trước đó để bạn tiếp tục ôn tập.",
                  })}
                </p>
              </div>
            </div>

            {/* Option 2: reset_all */}
            <div
              role="radio"
              aria-checked={mode === "reset_all"}
              tabIndex={0}
              onClick={() => setMode("reset_all")}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setMode("reset_all");
                }
              }}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-all duration-150 outline-none",
                mode === "reset_all"
                  ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised",
              )}
            >
              <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border group-hover:border-border-strong">
                {mode === "reset_all" && (
                  <div className="size-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t("detail.learn.completion.resetAllTitle", {
                      defaultValue: "Đặt lại toàn bộ khóa học",
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-strong bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
                    0%
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground-muted">
                  {t("detail.learn.completion.resetAllDesc", {
                    defaultValue:
                      "Xóa tiến độ của tất cả bài học trong khóa này để bạn bắt đầu lại từ đầu.",
                  })}
                </p>
              </div>
            </div>
          </RadioGroup>

          {certificateIssued && (
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-3.5 text-xs">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                <ShieldCheck className="size-3.5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-0.5 leading-relaxed">
                <span className="block font-semibold text-success">
                  Chứng nhận được bảo lưu an toàn
                </span>
                <p className="text-foreground-muted">
                  {t("detail.learn.completion.revertPreserveCertificateNotice", {
                    defaultValue:
                      "Hoàn tác sẽ đưa tiến độ học tập về chưa hoàn thành để bạn tiếp tục ôn tập, chứng nhận đã cấp sẽ được bảo lưu. Bạn có muốn tiếp tục?",
                  })}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("detail.learn.completion.revertCancel", { defaultValue: "Hủy bỏ" })}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-4" aria-hidden />
            )}
            {t("detail.learn.completion.revertConfirm", {
              defaultValue: "Xác nhận hoàn tác",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
