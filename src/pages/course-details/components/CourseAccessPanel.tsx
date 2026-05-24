import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { intlLocale } from "@/lib/intl";
import {
  formatVndPrice,
  type Course,
  type CourseLesson,
} from "@/types/courses";
import type { CoursePaymentAccess } from "@/lib/payments";
import type { CoursePricing } from "../utils/pricing";

interface CourseAccessPanelProps {
  course: Course;
  resolvedCourseId: string | null;
  hasFullCourseAccess: boolean;
  isPaidUpfront: boolean;
  isFreeWithPaidCertificate: boolean;
  enrolled: boolean;
  paymentAccess: CoursePaymentAccess | null;
  progressPercent: number;
  nextLesson: CourseLesson | null;
  pricing: CoursePricing;
  previewLessons: CourseLesson[];
  isAuthenticated: boolean;
  enrolling: boolean;
  onContinue: () => void;
  onBuy: () => void;
  onStartPreview: () => void;
  onEnroll: () => void;
  className?: string;
}

export function CourseAccessPanel({
  course,
  resolvedCourseId,
  hasFullCourseAccess,
  isPaidUpfront,
  isFreeWithPaidCertificate,
  enrolled,
  paymentAccess,
  progressPercent,
  nextLesson,
  pricing,
  previewLessons,
  isAuthenticated,
  enrolling,
  onContinue,
  onBuy,
  onStartPreview,
  onEnroll,
  className,
}: CourseAccessPanelProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card",
        className,
      )}
    >
      <div className="border-b border-border-subtle bg-surface-raised px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">
          {hasFullCourseAccess
            ? translate("detail.accessPanel.ready")
            : translate("detail.accessPanel.unlockToStart")}
        </h3>
      </div>
      <div className="p-4">
        {hasFullCourseAccess ? (
          <>
            <p className="mb-3 text-sm leading-relaxed text-foreground-muted">
              {translate("detail.accessPanel.enterToLearn")}
            </p>
            {isPaidUpfront &&
            paymentAccess?.full_access_granted &&
            !enrolled ? (
              <div className="mb-4 rounded-md border border-success/25 bg-success/10 p-3 text-sm text-success">
                {translate("detail.accessPanel.paymentConfirmed")}
              </div>
            ) : null}
            {isPaidUpfront &&
            enrolled &&
            !paymentAccess?.full_access_granted ? (
              <div className="mb-4 rounded-md border border-success/25 bg-success/10 p-3 text-sm text-success">
                {translate("detail.accessPanel.keptAccess")}
              </div>
            ) : null}
            <div className="mb-4 rounded-md bg-surface-raised p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-foreground-muted">
                <span>{translate("detail.accessPanel.currentProgress")}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-base">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                {nextLesson
                  ? translate("detail.accessPanel.nextLessonLabel", {
                      title: nextLesson.title,
                    })
                  : translate("detail.accessPanel.endOfPath")}
              </p>
            </div>
            <Button
              className="w-full"
              size="default"
              type="button"
              onClick={onContinue}
              disabled={!resolvedCourseId}
            >
              {nextLesson
                ? translate("detail.spotlight.continueLearning")
                : translate("detail.spotlight.enterLearningPage")}
              <ArrowRight className="size-4" />
            </Button>
          </>
        ) : isPaidUpfront ? (
          <>
            <div className="mb-4 rounded-md bg-surface-raised p-3">
              <div className="text-xs text-foreground-muted">
                {translate("detail.accessPanel.priceLabel")}
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {formatVndPrice(pricing.display)}
              </div>
              {pricing.promoActive ? (
                <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                  <span className="line-through">
                    {formatVndPrice(pricing.base)}
                  </span>
                  {Number.isFinite(pricing.endsAt) ? (
                    <span className="block sm:inline">
                      {" "}
                      {translate("detail.accessPanel.promoEnds", {
                        date: new Date(pricing.endsAt).toLocaleString(
                          intlLocale(),
                        ),
                      })}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <p className="mb-4 text-sm leading-relaxed text-foreground-muted">
              {translate("detail.accessPanel.paidUpfrontCopy")}
              {previewLessons.length > 0
                ? translate("detail.accessPanel.previewAvailable", {
                    count: previewLessons.length,
                  })
                : translate("detail.accessPanel.previewNotAvailable")}
            </p>
            <div className="space-y-2">
              <Button
                className="w-full"
                size="default"
                onClick={onBuy}
                disabled={!resolvedCourseId}
              >
                {translate("detail.accessPanel.buyCourse")}
              </Button>
              <Button
                className="w-full"
                size="default"
                variant="outline"
                onClick={onStartPreview}
                disabled={previewLessons.length === 0}
              >
                {previewLessons.length > 0
                  ? translate("detail.accessPanel.tryFreePreview")
                  : translate("detail.accessPanel.noPreviewYet")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm leading-relaxed text-foreground-muted">
              {translate("detail.accessPanel.freeEnrollCopy")}
              {isFreeWithPaidCertificate
                ? translate("detail.accessPanel.certificateFeeSuffix", {
                    fee: formatVndPrice(course.certificate_fee_vnd ?? 0),
                  })
                : ""}
            </p>
            <Button
              className="w-full"
              size="default"
              disabled={enrolling}
              onClick={() => {
                if (!isAuthenticated) {
                  onEnroll();
                  return;
                }
                onEnroll();
              }}
            >
              {enrolling
                ? translate("detail.accessPanel.processing")
                : translate("detail.accessPanel.enrollAndEnter")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
