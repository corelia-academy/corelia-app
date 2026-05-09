import { useState } from "react";
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
import { fetchProjectInviteDisplayContextByProjectIds } from "@/lib/notificationInviteContext";

export default function ProjectInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("contests");
  const { t: tc } = useTranslation("common");
  const { isAuthenticated, authInitialized } = useAuth();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const safeToken = (token ?? "").trim();

  async function onAccept() {
    if (!safeToken) return;
    setBusy("accept");
    setMessage(null);
    try {
      const res = await acceptProjectInviteByToken(safeToken);
      toast.success(t("detail.inviteProject.accepted"));

      const pid = typeof res.project_id === "string" ? res.project_id : "";
      if (pid) {
        const ctx = await fetchProjectInviteDisplayContextByProjectIds([pid]);
        const href = ctx[pid]?.hackathonHref;
        if (href) {
          navigate(href, { replace: true });
          return;
        }
      }

      setMessage(t("detail.inviteProject.accepted"));
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : t("detail.inviteProject.errorFallback");
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    if (!safeToken) return;
    setBusy("decline");
    setMessage(null);
    try {
      await declineProjectInviteByToken(safeToken);
      setMessage(t("detail.inviteProject.declined"));
      toast.success(t("detail.inviteProject.declined"));
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : t("detail.inviteProject.errorFallback");
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

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
          ) : (
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
          )}

          {message ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
          ) : null}

          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/")}>
            {tc("nav.home")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
