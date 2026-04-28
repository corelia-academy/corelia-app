import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSePayCheckout, submitSePayCheckoutForm } from "@/lib/payments";
import { uploadFinalAssignmentFile } from "@/lib/storage";
import { formatVndPrice } from "@/types/courses";
import type { Course } from "@/types/courses";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type SubmissionRow = {
  status: "pending" | "approved" | "rejected";
  reviewer_comment?: string | null;
} | null;

export function FinalAssignmentPanel({
  courseId,
  course,
  profileId,
  isAdmin,
  certificateFeePaid,
  submission,
  translate,
  onSubmit,
}: {
  courseId: string;
  course: Course;
  profileId: string;
  isAdmin: boolean;
  certificateFeePaid: boolean;
  submission: SubmissionRow;
  translate: TranslateFn;
  onSubmit: (input: { content: string; fileUrls?: string[] }) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitContent, setSubmitContent] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [payingCertificateFee, setPayingCertificateFee] = useState(false);

  const requiresCertificatePayment =
    course.access_model === "free_with_paid_certificate";

  const canSubmitCertificateAssignment = useMemo(
    () => !requiresCertificatePayment || certificateFeePaid || isAdmin,
    [certificateFeePaid, isAdmin, requiresCertificatePayment],
  );

  const handleSubmit = async () => {
    if (!submitContent.trim()) return;
    setSubmitting(true);
    try {
      const fileUrls: string[] = [];
      for (const file of submitFiles) {
        const uploaded = await uploadFinalAssignmentFile(courseId, profileId, file);
        fileUrls.push(uploaded.url);
      }
      await onSubmit({
        content: submitContent.trim(),
        fileUrls: fileUrls.length ? fileUrls : undefined,
      });
      setSubmitContent("");
      setSubmitFiles([]);
    } catch (e) {
      console.warn("Submit failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayCertificateFee = async () => {
    const amount = Number(course.certificate_fee_vnd || 0);
    if (amount <= 0) {
      toast.error(translate("detail.learn.certificateFeeMissing"));
      return;
    }
    setPayingCertificateFee(true);
    try {
      const base = window.location.origin;
      const checkout = await createSePayCheckout({
        courseId,
        purpose: "certificate_fee",
        amountVnd: amount,
        successUrl: `${base}/checkout/success/certificate_fee/${courseId}`,
        errorUrl: `${base}/learn/${courseId}?payment=error`,
        cancelUrl: `${base}/learn/${courseId}?payment=cancel`,
      });
      window.sessionStorage.setItem(
        "corelia:lastCheckout",
        JSON.stringify({
          orderId: checkout.order_id,
          courseId,
          purpose: "certificate_fee",
          createdAt: Date.now(),
        }),
      );
      submitSePayCheckoutForm(checkout);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : translate("detail.learn.sepayCreateFailed"),
      );
    } finally {
      setPayingCertificateFee(false);
    }
  };

  if (!course.final_assignment_title) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <FileText className="size-5 text-primary" />
        <h2 className="text-lg font-medium text-foreground">
          {course.final_assignment_title}
        </h2>
      </div>
      {course.final_assignment_description ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {course.final_assignment_description}
        </p>
      ) : null}
      {course.final_assignment_instructions ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="whitespace-pre-wrap">
            {course.final_assignment_instructions}
          </p>
        </div>
      ) : null}

      {submission ? (
        <div className="mt-4 rounded-xl bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">
            {submission.status === "approved"
              ? translate("detail.learn.finalAssignment.status.approved")
              : submission.status === "rejected"
                ? translate("detail.learn.finalAssignment.status.rejected")
                : translate("detail.learn.finalAssignment.status.pending")}
          </p>
          {submission.reviewer_comment ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {submission.reviewer_comment}
            </p>
          ) : null}
        </div>
      ) : null}

      {requiresCertificatePayment && !submission && !canSubmitCertificateAssignment ? (
        <div className="mt-4 rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
          {translate("detail.learn.finalAssignment.certificateFeeRequired", {
            fee: formatVndPrice(course.certificate_fee_vnd),
          })}
          <div className="mt-3">
            <Button
              onClick={() => void handlePayCertificateFee()}
              disabled={payingCertificateFee}
              size="sm"
            >
              {payingCertificateFee
                ? translate("detail.learn.finalAssignment.creatingPayment")
                : translate("detail.learn.finalAssignment.payViaSePay")}
            </Button>
          </div>
        </div>
      ) : null}

      {(submission?.status === "rejected" ||
        (!submission && canSubmitCertificateAssignment)) ? (
        <div className="mt-4 space-y-3">
          <textarea
            placeholder={translate("detail.learn.finalAssignment.contentPlaceholder")}
            value={submitContent}
            onChange={(e) => setSubmitContent(e.target.value)}
            className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={6}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {translate("detail.learn.finalAssignment.attachmentsLabel")}
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.zip"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-none file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => setSubmitFiles(Array.from(e.target.files ?? []))}
            />
          </div>
          <Button onClick={() => void handleSubmit()} disabled={submitting || !submitContent.trim()}>
            {submitting
              ? translate("detail.learn.finalAssignment.submitting")
              : translate("detail.learn.finalAssignment.submit")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

