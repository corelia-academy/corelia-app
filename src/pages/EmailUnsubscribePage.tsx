import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { coreliaEdgeUrl } from "@/lib/coreliaEdgeApi";
import { supabasePublicClientKey } from "@/lib/supabase";

const ANON_KEY = supabasePublicClientKey();

type Status = "loading" | "success" | "error";

function resolveInitialStatus(token: string): Status {
  if (!token) return "error";
  if (!coreliaEdgeUrl("notifications.unsubscribe")) return "error";
  return "loading";
}

export function EmailUnsubscribePage() {
  const { t } = useTranslation("common");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const type = params.get("type") ?? "course_blast";
  const [status, setStatus] = useState<Status>(() => resolveInitialStatus(token));

  useEffect(() => {
    if (status !== "loading") return;
    const url = coreliaEdgeUrl("notifications.unsubscribe");
    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ token, type }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
    // Run only once on mount — token/type from URL don't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
