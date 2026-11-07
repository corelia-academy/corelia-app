import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

type AuthorizationDetails = {
  authorization_id?: string;
  redirect_url?: string;
  redirect_uri?: string;
  scope?: string;
  client?: { name?: string; client_id?: string };
};

export default function OAuthConsent() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const errorMessage = authorizationId ? error : t("oauthConsent.missingRequest");

  useEffect(() => {
    if (!authorizationId) return;

    let active = true;

    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError || !data) {
        setError(requestError?.message ?? t("oauthConsent.invalidRequest"));
        return;
      }
      const authDetails = data as AuthorizationDetails;
      if (!authDetails.authorization_id && authDetails.redirect_url) {
        window.location.assign(authDetails.redirect_url);
        return;
      }
      setDetails(authDetails);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : t("oauthConsent.invalidRequest"));
    });

    return () => { active = false; };
  }, [authorizationId, t]);

  const decide = async (decision: "approve" | "deny") => {
    if (!authorizationId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = decision === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (response.error) {
        setError(response.error.message);
        setBusy(false);
        return;
      }
      if (!response.data?.redirect_url) {
        setError(t("oauthConsent.redirectFailed"));
        setBusy(false);
        return;
      }
      window.location.assign(response.data.redirect_url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("oauthConsent.redirectFailed"));
      setBusy(false);
    }
  };

  const scopes = details?.scope?.trim().split(/\s+/).filter(Boolean) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <Card className="w-full space-y-6 p-6 md:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("oauthConsent.title")}</h1>
          <p className="text-sm text-foreground-muted">{t("oauthConsent.description")}</p>
        </div>

        {errorMessage && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}

        {details && (
          <dl className="grid gap-3 rounded-xl border border-border-subtle p-4 text-sm">
            <div>
              <dt className="font-medium">{t("oauthConsent.client")}</dt>
              <dd className="break-all text-foreground-muted">{details.client?.name ?? details.client?.client_id ?? t("oauthConsent.unknownClient")}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("oauthConsent.redirectUri")}</dt>
              <dd className="break-all text-foreground-muted">{details.redirect_uri ?? t("oauthConsent.notProvided")}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("oauthConsent.permissions")}</dt>
              {scopes.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground-muted">
                  {scopes.map((scope) => <li key={scope}>{scope}</li>)}
                </ul>
              ) : <dd className="text-foreground-muted">{t("oauthConsent.noScopes")}</dd>}
            </div>
          </dl>
        )}

        <p className="text-sm text-foreground-muted">{t("oauthConsent.adminOnly")}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="cta" hierarchy="secondary" disabled={!details || busy} onClick={() => void decide("deny")}>
            {busy ? t("oauthConsent.processing") : t("oauthConsent.deny")}
          </Button>
          <Button variant="cta" hierarchy="primary" disabled={!details || busy} onClick={() => void decide("approve")}>
            {busy ? t("oauthConsent.processing") : t("oauthConsent.approve")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
