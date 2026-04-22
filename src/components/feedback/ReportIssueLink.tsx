import { Bug } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

type ReportIssueLinkProps = {
  compact?: boolean;
  className?: string;
};

export function ReportIssueLink({
  compact = false,
  className,
}: ReportIssueLinkProps) {
  const { t } = useTranslation("common");
  const href = import.meta.env.VITE_BETA_FEEDBACK_FORM_URL?.trim() || "";

  if (!href) return null;

  return (
    <Button
      render={
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        />
      }
      nativeButton={false}
      size="sm"
      variant="ghost"
      className={className}
    >
      <Bug className="size-4" weight="duotone" />
      {compact ? t("feedback.reportIssue.short") : t("feedback.reportIssue.long")}
    </Button>
  );
}
