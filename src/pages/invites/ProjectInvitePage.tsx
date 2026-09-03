import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/stores/authStore";
import {
  acceptProjectInviteByToken,
  declineProjectInviteByToken,
} from "@/lib/notifications";
import {
  projectInviteContextQueryOptions,
  projectInvitePreviewQueryOptions,
} from "@/features/invites/inviteQueries";
import type { TFunction } from "i18next";

function formatInviteError(err: unknown, t: TFunction<"contests">): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.startsWith("wrong_account")) {
    const email = raw.split(":")[1] || "";
    return t("detail.inviteProject.wrongAccountBody", { email });
  }
  if (/invalid_token|not_found|missing|expired/i.test(raw)) {
    return t("detail.inviteProject.invalid");
  }
  if (raw.startsWith("not_actionable")) {
    const status = raw.split(":")[1] || "resolved";
    return t("detail.inviteProject.notActionable", { status });
  }
  return t("detail.inviteProject.errorFallback");
}

export default function ProjectInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("contests");
  const { t: tc } = useTranslation("common");
  const { isAuthenticated, authInitialized, user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeToken = (token ?? "").trim();
  const previewQuery = useQuery(projectInvitePreviewQueryOptions({
    token: safeToken,
    userId: user?.id,
    enabled: authInitialized && isAuthenticated,
  }));
  const preview = previewQuery.data ?? null;
  const previewError = previewQuery.error
    ? formatInviteError(previewQuery.error, t)
    : null;
  const acceptMutation = useMutation({ mutationFn: acceptProjectInviteByToken });
  const declineMutation = useMutation({ mutationFn: declineProjectInviteByToken });
  const busy = acceptMutation.isPending
    ? "accept"
    : declineMutation.isPending
      ? "decline"
      : null;

  async function onAccept() {
    if (!safeToken) return;
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await acceptMutation.mutateAsync(safeToken);
      toast.success(t("detail.inviteProject.accepted"));

      const pid = typeof res.project_id === "string" ? res.project_id : "";
      if (pid) {
        const ctx = await queryClient.fetchQuery(projectInviteContextQueryOptions(pid));
        const href = ctx?.hackathonHref;
        if (href) {
          navigate(href, { replace: true });
          return;
        }
      }

      setMessage(t("detail.inviteProject.accepted"));
    } catch (e) {
      const msg = formatInviteError(e, t);
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  async function onDecline() {
    if (!safeToken) return;
    setMessage(null);
    setErrorMessage(null);
    try {
      await declineMutation.mutateAsync(safeToken);
      setMessage(t("detail.inviteProject.declined"));
      toast.success(t("detail.inviteProject.declined"));
    } catch (e) {
      const msg = formatInviteError(e, t);
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  const isResolved = Boolean(message || errorMessage);

  return (
    <div className="container-app flex min-h-[50vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-lg font-semibold text-foreground">
            {t("detail.inviteProject.title")}
          </h1>
          <p className="text-sm text-foreground-muted">
            {t("detail.inviteProject.description")}
          </p>

          {preview?.project_title && (
            <p className="rounded-xl border border-border-subtle bg-surface-raised p-3 text-sm font-medium text-foreground">
              {t("detail.inviteProject.previewSummary", { project: preview.project_title })}
            </p>
          )}

          {!authInitialized ? (
            <p className="text-sm text-foreground-muted">{tc("status.loading")}</p>
          ) : !isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground-muted">
                {t("detail.inviteProject.loginRequired")}
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() =>
                  navigate("/login", {
                    state: { from: { pathname: window.location.pathname } },
                  })
                }
              >
                {t("detail.inviteProject.ctaLogin")}
              </Button>
            </div>
          ) : !safeToken ? (
            <p className="text-sm text-destructive">{t("detail.inviteProject.invalid")}</p>
          ) : previewQuery.isPending ? (
            <p className="text-sm text-foreground-muted">{tc("status.loading")}</p>
          ) : previewError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{previewError}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void previewQuery.refetch()}
              >
                {t("detail.inviteProject.retry", { defaultValue: "Thử lại" })}
              </Button>
            </div>
          ) : isResolved ? (
            <div className="space-y-2">
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
              )}
            </div>
          ) : preview ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => void onAccept()}
              >
                {busy === "accept" ? tc("status.loading") : t("detail.inviteProject.ctaAccept")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => void onDecline()}
              >
                {busy === "decline" ? tc("status.loading") : t("detail.inviteProject.ctaDecline")}
              </Button>
            </div>
          ) : null}

          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/")}>
            {tc("nav.home")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
