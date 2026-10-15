import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Inline load-failure block with a retry action. Render it before the empty state so a failed
 * query never reads as "no data".
 */
export function QueryErrorState({
  message,
  onRetry,
  retrying = false,
  className,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <div role="alert" className={cn("rounded-xl border border-border-subtle p-5 text-center", className)}>
      <p className="text-sm text-foreground">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="cta"
          hierarchy="secondary"
          size="small"
          className="mt-3"
          disabled={retrying}
          onClick={onRetry}
        >
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}
