import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, Flag, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { submitCourseReport, type CourseReportReason } from "@/lib/courseReports";
import { useAuth } from "@/stores/authStore";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";

const reasons: Array<{ value: CourseReportReason; label: string }> = [
  { value: "copyright", label: "Copyright / DMCA" },
  { value: "spam", label: "Spam or low-quality content" },
  { value: "misleading", label: "Misleading title or description" },
  { value: "unsafe", label: "Unsafe or harmful content" },
  { value: "other", label: "Other" },
];

export function CourseReportDialog({
  courseId,
  courseTitle,
}: {
  courseId: string | null;
  courseTitle: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CourseReportReason>("copyright");
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isAuthenticated || !profile?.id) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (!courseId) return;

    setSubmitting(true);
    try {
      await submitCourseReport({
        courseId,
        reporterId: profile.id,
        reason,
        details,
        contactEmail,
        metadata: {
          courseTitle,
          pageUrl: window.location.href,
        },
      });
      toast.success("Da gui report. Doi ngu Corelia se xem xet.");
      setOpen(false);
      setDetails("");
      setContactEmail("");
      setReason("copyright");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Khong the gui report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start text-foreground-muted"
        onClick={() => setOpen(true)}
        disabled={!courseId}
      >
        <Flag className="size-4" aria-hidden />
        Report course / DMCA
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report this course</DialogTitle>
            <DialogDescription>
              Reports are private and reviewed by Corelia staff. For copyright claims, include
              the original source and why this course may violate your rights.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-foreground">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 text-warning" aria-hidden />
                <span>Please do not include passwords, payment details, or private keys.</span>
              </div>
            </div>

            <Field>
              <FieldLabel>Reason</FieldLabel>
              <select
                className={inputClass}
                value={reason}
                onChange={(event) => setReason(event.target.value as CourseReportReason)}
              >
                {reasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel>Details</FieldLabel>
              <FieldDescription>Minimum 10 characters. Add URLs if relevant.</FieldDescription>
              <textarea
                className={`${inputClass} min-h-32 resize-y`}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Describe the issue..."
              />
            </Field>

            <Field>
              <FieldLabel>Contact email (optional)</FieldLabel>
              <input
                className={inputClass}
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || details.trim().length < 10}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Sending...
                </>
              ) : (
                "Submit report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
