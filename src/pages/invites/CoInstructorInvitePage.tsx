import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/stores/authStore";
import {
  acceptCoInstructorInviteByToken,
  declineCoInstructorInviteByToken,
  peekCoInstructorInviteByToken,
  type CoInstructorInvitePreview,
} from "@/lib/coInstructorInvites";
import type { TFunction } from "i18next";

function formatCoInstructorError(err: unknown, t: TFunction<"courses">): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/invalid_token|not_found|expired|missing/i.test(raw)) {
    return t("inviteCoInstructor.invalid");
  }
  return t("inviteCoInstructor.errorFallback");
}

export default function CoInstructorInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("courses");
  const { t: tc } = useTranslation("common");
  const { isAuthenticated, authInitialized, user, signOut } = useAuth();
  const [busy, setBusy] = useState<"accept" | "decline" | "switch" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<CoInstructorInvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [wrongAccount, setWrongAccount] = useState(false);

  const safeToken = (token ?? "").trim();

  useEffect(() => {
    if (!authInitialized || !isAuthenticated || !safeToken) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    setWrongAccount(false);
    peekCoInstructorInviteByToken(safeToken)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "invite_preview_failed";
        if (msg === "forbidden") {
          setWrongAccount(true);
        } else {
          setPreviewError(formatCoInstructorError(e, t));
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, isAuthenticated, safeToken, t]);

  async function onSignOutAndSwitch() {
    setBusy("switch");
    try {
      await signOut();
      navigate("/login", {
        state: { from: { pathname: window.location.pathname } },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inviteCoInstructor.errorFallback"));
    } finally {
      setBusy(null);
    }
  }

  async function onAccept() {
    if (!safeToken) return;
    setBusy("accept");
    setMessage(null);
    try {
      const res = await acceptCoInstructorInviteByToken(safeToken);
      toast.success(t("inviteCoInstructor.accepted"));
      if (res?.course_id) {
        navigate(`/instructor/courses/${res.course_id}/edit`, { replace: true });
        return;
      }
      setMessage(t("inviteCoInstructor.accepted"));
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      if (raw === "forbidden") {
        setWrongAccount(true);
      } else {
        const friendly = formatCoInstructorError(e, t);
        setMessage(friendly);
        toast.error(friendly);
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    if (!safeToken) return;
    setBusy("decline");
    setMessage(null);
    try {
      await declineCoInstructorInviteByToken(safeToken);
      setMessage(t("inviteCoInstructor.declined"));
      toast.success(t("inviteCoInstructor.declined"));
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      if (raw === "forbidden") {
        setWrongAccount(true);
      } else {
        const friendly = formatCoInstructorError(e, t);
        setMessage(friendly);
        toast.error(friendly);
      }
    } finally {
      setBusy(null);
    }
  }

  const enabledPermissions = preview
    ? Object.entries(preview.permissions ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : [];

  return (
    <div className="container-app flex min-h-[50vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-lg font-semibold text-foreground">
            {t("inviteCoInstructor.title")}
          </h1>

          {!authInitialized ? (
            <p className="text-sm text-foreground-muted">{tc("status.loading")}</p>
          ) : !isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground-muted">
                {t("inviteCoInstructor.loginRequired")}
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
                {t("inviteCoInstructor.ctaLogin")}
              </Button>
            </div>
          ) : !safeToken ? (
            <p className="text-sm text-destructive">
              {t("inviteCoInstructor.invalid")}
            </p>
          ) : wrongAccount ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                {t("inviteCoInstructor.wrongAccountTitle")}
              </p>
              <p className="text-sm text-foreground-muted">
                {t("inviteCoInstructor.wrongAccountBody", {
                  email: user?.email ?? "",
                })}
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={busy !== null}
                onClick={() => void onSignOutAndSwitch()}
              >
                {busy === "switch"
                  ? tc("status.loading")
                  : t("inviteCoInstructor.signOutAndSwitch")}
              </Button>
            </div>
          ) : previewLoading ? (
            <p className="text-sm text-foreground-muted">{tc("status.loading")}</p>
          ) : previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : preview ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {t("inviteCoInstructor.summary", {
                  inviter: preview.inviter_name || tc("nav.someone"),
                  course: preview.course_title || t("inviteCoInstructor.courseFallback"),
                })}
              </p>
              {enabledPermissions.length > 0 ? (
                <p className="text-xs text-foreground-muted">
                  {t("inviteCoInstructor.permissions", {
                    list: enabledPermissions.join(", "),
                  })}
                </p>
              ) : null}
              <p className="text-xs text-foreground-muted">
                {t("inviteCoInstructor.expiresAt", {
                  date: new Date(preview.expires_at).toLocaleString(),
                })}
              </p>
              {preview.is_expired || preview.status !== "pending" ? (
                <p className="text-sm text-destructive">
                  {t("inviteCoInstructor.notActionable", { status: preview.status })}
                </p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={busy !== null}
                    onClick={() => void onAccept()}
                  >
                    {busy === "accept"
                      ? tc("status.loading")
                      : t("inviteCoInstructor.ctaAccept")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={busy !== null}
                    onClick={() => void onDecline()}
                  >
                    {busy === "decline"
                      ? tc("status.loading")
                      : t("inviteCoInstructor.ctaDecline")}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {message ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            {tc("nav.home")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
