import { useMemo, useState } from "react";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { updateOCIDProfileForUser } from "@/lib/profile";
import { useTranslation } from "react-i18next";

function truncateMiddle(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function ConnectOCIDCard() {
  const { t } = useTranslation("account");
  const { user, profile, refreshProfile } = useAuth();
  const { isInitialized, authState, ocAuth } = useOCAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const connected = Boolean(profile?.ocid);

  const ocidDisplay = useMemo(() => {
    const ocid = profile?.ocid ?? null;
    if (!ocid) return null;
    return truncateMiddle(ocid, 8, 6);
  }, [profile?.ocid]);

  const ethDisplay = useMemo(() => {
    const addr = profile?.ocid_eth_address ?? null;
    if (!addr) return null;
    return truncateMiddle(addr, 10, 6);
  }, [profile?.ocid_eth_address]);

  async function handleConnect() {
    setError(null);
    setSuccess(null);
    try {
      if (!isInitialized) return;
      setLoading(true);
      await ocAuth.signInWithRedirect({ state: "corelia-ocid-connect" });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t("ocid.toasts.startConnectFailed");
      setError(message);
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (!user) return;
      await updateOCIDProfileForUser(user, {
        ocid: null,
        ocid_eth_address: null,
      });
      await refreshProfile(user);
      setSuccess(t("ocid.toasts.disconnectSuccess"));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t("ocid.toasts.disconnectFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border-subtle bg-surface-base p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t("ocid.card.title")}</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("ocid.card.description")}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground-muted">
          {connected
            ? t("ocid.card.statusConnected")
            : t("ocid.card.statusDisconnected")}
        </span>
      </div>

      {!isInitialized ? (
        <div className="rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
          {t("ocid.card.initializing")}
        </div>
      ) : authState.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {authState.error.message}
        </div>
      ) : connected ? (
        <div className="grid gap-3 rounded-md border border-border-subtle bg-surface-base p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-foreground-muted">
              {t("ocid.card.ocidLabel")}
            </div>
            <div className="font-mono text-foreground">
              {ocidDisplay ?? profile?.ocid ?? "—"}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-foreground-muted">
              {t("ocid.card.ethAddressLabel")}
            </div>
            <div className="font-mono text-foreground">
              {ethDisplay ?? profile?.ocid_eth_address ?? "—"}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
          {t("ocid.card.connectHint")}
        </div>
      )}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">
          {success}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {connected ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDisconnect}
            disabled={loading || !isInitialized}
          >
            {loading
              ? t("ocid.card.loadingDisconnect")
              : t("ocid.card.disconnect")}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleConnect}
            disabled={loading || !isInitialized}
            className="h-11 cursor-pointer border border-border-subtle bg-ocid-blue text-white px-3 py-2.5 text-left text-sm hover:opacity-90 active:opacity-80"
          >
            <img
              src="/logo/OC-square-logo.svg"
              alt="Open Campus"
              className="h-full rounded-full"
            />

            {loading ? (
              t("ocid.card.loadingConnect")
            ) : (
              <span>{t("ocid.card.connect")}</span>
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
