import { useState } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Info, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioCard } from "@/components/ui/selection";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <RotateCcw className="size-5 text-foreground-muted" aria-hidden />
            <DialogTitle className="text-heading-small font-display">
              {t("detail.learn.completion.revertDialogTitle", {
                defaultValue: "Hoàn tác trạng thái hoàn thành khóa học",
              })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-body-small text-foreground-muted">
            {t("detail.learn.completion.revertDialogDescription", {
              defaultValue:
                "Chọn hình thức hoàn tác để đưa khóa học trở lại trạng thái đang học.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={mode}
            onValueChange={(val) => setMode(val as RevertCourseCompletionMode)}
            className="flex flex-col gap-sm"
          >
            <RadioCard
              value="last_lesson"
              label={t("detail.learn.completion.revertLastLessonTitle", {
                defaultValue: "Hoàn tác bài học gần nhất (Khuyên dùng)",
              })}
              supportingText={t("detail.learn.completion.revertLastLessonDesc", {
                defaultValue:
                  "Khóa học sẽ trở về trạng thái đang học với tiến độ trước đó để bạn tiếp tục ôn tập.",
              })}
              orientation="vertical"
              size="small"
            />
            <RadioCard
              value="reset_all"
              label={t("detail.learn.completion.resetAllTitle", {
                defaultValue: "Đặt lại toàn bộ khóa học (0%)",
              })}
              supportingText={t("detail.learn.completion.resetAllDesc", {
                defaultValue:
                  "Xóa tiến độ của tất cả bài học trong khóa này để bạn bắt đầu lại từ đầu.",
              })}
              orientation="vertical"
              size="small"
            />
          </RadioGroup>

          {certificateIssued && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-raised p-3 text-xs leading-relaxed text-foreground-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                {t("detail.learn.completion.revertPreserveCertificateNotice", {
                  defaultValue:
                    "Hoàn tác sẽ đưa tiến độ học tập về chưa hoàn thành để bạn tiếp tục ôn tập, chứng nhận đã cấp sẽ được bảo lưu. Bạn có muốn tiếp tục?",
                })}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
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
