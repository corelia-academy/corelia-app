import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { unsubscribeFromNotifications } from "@/lib/notificationPreferences";

type Status = "loading" | "success" | "error";

export function EmailUnsubscribePage() {
  const { t } = useTranslation("common");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const type = params.get("type") ?? "course_blast";
  const {
    mutateAsync: unsubscribe,
    isSuccess,
    isError,
  } = useMutation({ mutationFn: unsubscribeFromNotifications });
  const status: Status = !token
    ? "error"
    : isSuccess
      ? "success"
      : isError
        ? "error"
        : "loading";

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    void unsubscribe({ token, type, signal: controller.signal })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [token, type, unsubscribe]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-base shadow-card p-8 text-center shadow-sm">
        {status === "loading" && (
          <p className="text-sm text-foreground-muted">{t("unsubscribe.loading")}</p>
        )}
        {status === "success" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">
              {t("unsubscribe.successTitle")}
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("unsubscribe.successBody")}
            </p>
            <Link
              to="/account/settings"
              className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
            >
              {t("unsubscribe.managePreferences")}
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">
              {t("unsubscribe.errorTitle")}
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("unsubscribe.errorBody")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
