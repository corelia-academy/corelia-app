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
import { RadioCard } from "@/components/ui/selection";
import type { RevertCourseCompletionMode } from "@/lib/courses";

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
            <RadioCard
              value="last_lesson"
              label={
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  <span>
                    {t("detail.learn.completion.revertLastLessonTitle", {
                      defaultValue: "Hoàn tác bài học gần nhất",
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {t("detail.learn.completion.revertRecommendedBadge", {
                      defaultValue: "Khuyên dùng",
                    })}
                  </span>
                </span>
              }
              supportingText={
                <span className="leading-relaxed">
                  {t("detail.learn.completion.revertLastLessonDesc", {
                    defaultValue:
                      "Khóa học sẽ trở về trạng thái đang học với tiến độ trước đó để bạn tiếp tục ôn tập.",
                  })}
                </span>
              }
              orientation="horizontal"
              size="small"
            />

            <RadioCard
              value="reset_all"
              label={
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  <span>
                    {t("detail.learn.completion.resetAllTitle", {
                      defaultValue: "Đặt lại toàn bộ khóa học",
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-strong bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
                    {t("detail.learn.completion.resetAllBadge", {
                      defaultValue: "0%",
                    })}
                  </span>
                </span>
              }
              supportingText={
                <span className="leading-relaxed">
                  {t("detail.learn.completion.resetAllDesc", {
                    defaultValue:
                      "Xóa tiến độ của tất cả bài học trong khóa này để bạn bắt đầu lại từ đầu.",
                  })}
                </span>
              }
              orientation="horizontal"
              size="small"
            />
          </RadioGroup>

          {certificateIssued && (
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-3.5 text-xs">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                <ShieldCheck className="size-3.5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-0.5 leading-relaxed">
                <span className="block font-semibold text-success">
                  {t("detail.learn.completion.revertPreserveCertificateTitle", {
                    defaultValue: "Chứng nhận được bảo lưu an toàn",
                  })}
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
