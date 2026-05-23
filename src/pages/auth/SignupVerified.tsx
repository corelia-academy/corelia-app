import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/base/LanguageSwitcher";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";

const SESSION_WAIT_MS = 12_000;
const REDIRECT_SECONDS = 5;

async function waitForActiveSession(maxMs: number): Promise<Session | null> {
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();
  if (initial?.user) return initial;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      subscription.unsubscribe();
      resolve(null);
    }, maxMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.clearTimeout(timer);
        subscription.unsubscribe();
        resolve(session);
      }
    });
  });
}

function parseAuthErrorFromLocation(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;

  const fromHash = new URLSearchParams(hash);
  const fromSearch = new URLSearchParams(search);

  const code =
    fromHash.get("error_code") ??
    fromSearch.get("error_code") ??
    fromHash.get("error") ??
    fromSearch.get("error");
  const desc =
    fromHash.get("error_description") ?? fromSearch.get("error_description");

  if (!code && !desc) return null;
  try {
    return desc ? decodeURIComponent(desc.replace(/\+/g, " ")) : code;
  } catch {
    return desc ?? code;
  }
}

export default function SignupVerified() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();

  const initialError = useMemo(() => parseAuthErrorFromLocation(), []);

  const [phase, setPhase] = useState<"waiting" | "success" | "error">(
    initialError ? "error" : "waiting",
  );
  const [failureReason, setFailureReason] = useState<string | null>(initialError);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (initialError) return;

    let cancelled = false;
    void (async () => {
      const session = await waitForActiveSession(SESSION_WAIT_MS);
      if (cancelled) return;
      if (session?.user) {
        setSecondsLeft(REDIRECT_SECONDS);
        setPhase("success");
        return;
      }
      setFailureReason(parseAuthErrorFromLocation());
      setPhase("error");
    })();

    return () => {
      cancelled = true;
    };
  }, [initialError]);

  useEffect(() => {
    if (phase !== "success") return;

    const countdownId = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    const redirectId = window.setTimeout(() => {
      window.clearInterval(countdownId);
      navigate("/", { replace: true });
    }, REDIRECT_SECONDS * 1000);

    return () => {
      window.clearInterval(countdownId);
      window.clearTimeout(redirectId);
    };
  }, [phase, navigate]);

  const errorMessage = (failureReason?.trim() || t("signupVerified.sessionError")).trim();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <NavLink
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{t("confirmSignup.backHome")}</span>
          </NavLink>
          <LanguageSwitcher />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {phase === "waiting" ? (
            <>
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {t("signupVerified.waitingTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {t("signupVerified.waitingBody")}
              </p>
            </>
          ) : null}

          {phase === "success" ? (
            <>
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {t("signupVerified.successTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {t("signupVerified.successBody")}
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">
                {t("signupVerified.redirectCountdown", { seconds: Math.max(0, secondsLeft) })}
              </p>
            </>
          ) : null}

          {phase === "error" ? (
            <>
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {t("signupVerified.errorTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{errorMessage}</p>
              <p className="mt-6 text-center text-sm">
                <NavLink
                  to="/login"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("signupVerified.goLogin")}
                </NavLink>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
