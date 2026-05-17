import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LoginCallBack, useOCAuth } from "@opencampus/ocid-connect-js";
import { updateOCIDProfileForUser } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "react-i18next";

type OCAuthStateMaybe = {
  OCId?: string;
  ethAddress?: string;
} | null | undefined;

function Loading() {
  const { t } = useTranslation("account");
  return (
    <div className="container-app py-10">
      <div className="rounded-lg border border-border-subtle bg-surface-base p-6">
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
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { OCId, ethAddress, ocAuth } = useOCAuth();
  const [error, setError] = useState<string | null>(null);

  const callbacks = useMemo(() => {
    return {
      successCallback: async () => {
        setError(null);
        let user = useAuthStore.getState().user;
        if (!user) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
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
        const resolvedEth =
          (maybe?.ethAddress ?? undefined) ??
          ethAddress ??
          null;

        if (!resolvedOCId) {
          setError(t("ocid.redirect.missingOcidFromSession"));
          navigate("/account", { replace: true });
          return;
        }

        try {
          await updateOCIDProfileForUser(user, {
            ocid: resolvedOCId,
            ocid_eth_address: resolvedEth,
          });
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
  }, [OCId, ethAddress, navigate, ocAuth, refreshProfile, t]);

  return (
    <div className="min-h-[60vh]">
      {error ? (
        <div className="container-app py-10">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : null}
      <LoginCallBack
        customLoadingComponent={<Loading />}
        customErrorComponent={<ErrorView />}
        successCallback={callbacks.successCallback}
        errorCallback={callbacks.errorCallback}
      />
    </div>
  );
}

