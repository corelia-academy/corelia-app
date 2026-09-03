import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { CERT_PLACEHOLDER } from "@/pages/achievements/constants";
import { pendingCredentialClaimQueryOptions } from "@/features/credentials/credentialQueries";

type Status = "loading" | "loaded" | "error";

export function ClaimPage() {
  const { t } = useTranslation("common");
  const [params] = useSearchParams();
  const email = (params.get("email") ?? "").trim();
  const claimQuery = useQuery(pendingCredentialClaimQueryOptions(email));
  const status: Status = !email || claimQuery.isError
    ? "error"
    : claimQuery.isPending
      ? "loading"
      : "loaded";
  const items = claimQuery.data?.items ?? [];

  const signupUrl = `/login?mode=signup&email=${encodeURIComponent(email)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-base shadow-card p-8 text-center shadow-sm">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-foreground-muted">{t("claim.loading")}</p>
          </div>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">{t("claim.errorTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("claim.errorBody")}</p>
          </>
        )}

        {status === "loaded" && items.length === 0 && (
          <>
            <h1 className="text-xl font-semibold text-foreground">{t("claim.emptyTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("claim.emptyBody")}</p>
          </>
        )}

        {status === "loaded" && items.length > 0 && (
          <>
            <h1 className="text-xl font-semibold text-foreground">{t("claim.title")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("claim.subtitle", { email })}
            </p>

            <div className="mt-5 space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 text-left"
                >
                  <img
                    src={item.imageUrl || CERT_PLACEHOLDER}
                    alt=""
                    className="size-12 shrink-0 rounded object-contain opacity-70 blur-[1px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <span className="inline-block rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                      {t("claim.pendingBadge")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to={signupUrl}
              className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("claim.cta")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
