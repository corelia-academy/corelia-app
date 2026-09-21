import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { LoginCallBack, useOCAuth } from "@opencampus/ocid-connect-js";
import { connectVerifiedOCID } from "@/lib/profile";
import { getAuthSession } from "@/lib/auth";
import { invokeCoreliaApi } from "@/lib/coreliaEdgeApi";
import { useAuth, useAuthStore } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type OCAuthStateMaybe = {
  OCId?: string;
  ethAddress?: string;
  idToken?: string;
} | null | undefined;

function Loading() {
  const { t } = useTranslation("account");
  return (
    <div className="container-app py-10">
      <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="text-sm text-foreground-muted">
            {t("ocid.redirect.finishing")}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorView() {
  const { t } = useTranslation("account");
  const { authState } = useOCAuth();
  return (
    <div className="container-app py-10">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
        {authState.error?.message ?? t("ocid.redirect.connectFailedFallback")}
      </div>
    </div>
  );
}

export default function OCIDRedirect() {
  const { t } = useTranslation("account");
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { OCId, ocAuth } = useOCAuth();
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: linkOcid } = useMutation({
    mutationFn: async (idToken: string) => {
      const awarded = await connectVerifiedOCID(idToken);
      if (awarded) toast.success(t("xp.connections.ocidXpEarned"));
      void invokeCoreliaApi("credentials.retryPending", {});
    },
  });

  const callbacks = useMemo(() => {
    return {
      successCallback: async () => {
        setError(null);
        let user = useAuthStore.getState().user;
        if (!user) {
          const session = await getAuthSession();
          user = session?.user ?? null;
        }
        if (!user) {
          setError(t("ocid.redirect.mustLoginFirst"));
          navigate("/login", { replace: true });
          return;
        }

        const authState = ocAuth?.getAuthState?.();
        const maybe = (authState && typeof authState === "object"
          ? (authState as OCAuthStateMaybe)
          : undefined);
        const resolvedOCId =
          (maybe?.OCId ?? undefined) ??
          OCId ??
          null;
        const idToken = maybe?.idToken ?? null;

        if (!resolvedOCId || !idToken) {
          setError(t("ocid.redirect.missingOcidFromSession"));
          navigate("/account", { replace: true });
          return;
        }

        try {
          await linkOcid(idToken);
          await refreshProfile(user);
          navigate("/account", { replace: true });
        } catch (e) {
          const message =
            e instanceof Error && e.message === "OCID_ALREADY_LINKED"
              ? t("ocid.redirect.alreadyLinkedToOtherAccount")
              : e instanceof Error
                ? e.message
                : t("ocid.redirect.connectFailedFallback");
          setError(message);
        }
      },
      errorCallback: (e: unknown) => {
        const message =
          e instanceof Error ? e.message : t("ocid.redirect.connectFailedFallback");
        setError(message);
      },
    };
  }, [OCId, linkOcid, navigate, ocAuth, refreshProfile, t]);

  return (
    <div className="min-h-[60vh]">
      {error ? (
        <div className="container-app py-10 flex flex-col gap-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
          <div>
            <Button variant="outline" onClick={() => navigate("/")}>
              {t("ocid.redirect.backToHome")}
            </Button>
          </div>
        </div>
      ) : (
        <LoginCallBack
          customLoadingComponent={<Loading />}
          customErrorComponent={<ErrorView />}
          successCallback={callbacks.successCallback}
          errorCallback={callbacks.errorCallback}
        />
      )}
    </div>
  );
}
