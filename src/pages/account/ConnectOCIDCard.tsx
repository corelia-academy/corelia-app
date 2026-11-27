import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SettingsRow } from "./SettingsLayout";
import { useAuth } from "@/stores/authStore";
import { disconnectOCID } from "@/lib/profile";
import { mintedCredentialCountQueryOptions } from "@/features/account/accountQueries";
import { useTranslation } from "react-i18next";
import { appPath } from "@/lib/appUrl";

function truncateMiddle(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function ConnectOCIDCard() {
  const { t } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const { user, profile, refreshProfile } = useAuth();
  const { isInitialized, authState, ocAuth } = useOCAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const connected = Boolean(profile?.ocid);
  const mintedCountQuery = useQuery(
    mintedCredentialCountQueryOptions(user?.id, connected),
  );
  const mintedCount = mintedCountQuery.data ?? 0;

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

  function handleDisconnectClick() {
    setError(null);
    setSuccess(null);
    setShowDisconnectDialog(true);
  }

  async function handleDisconnectConfirm() {
    setShowDisconnectDialog(false);
    setLoading(true);
    try {
      if (!user) return;
      await disconnectOCID();
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
    <div id="connect-ocid" tabIndex={-1} className="flex flex-col gap-3 rounded-md">
      <SettingsRow
        title={t("ocid.card.title")}
        description={
          connected ? (
            <>
              {t("ocid.card.ocidLabel")}: <span className="font-mono">{ocidDisplay ?? profile?.ocid ?? "-"}</span>
              <br />
              {t("ocid.card.ethAddressLabel")}: <span className="font-mono">{ethDisplay ?? profile?.ocid_eth_address ?? "-"}</span>
            </>
          ) : t("ocid.card.description")
        }
        action={
          connected ? (
            <Button type="button" variant="destructive" hierarchy="secondary" size="small" onClick={handleDisconnectClick} disabled={loading || !isInitialized}>
              {loading ? t("ocid.card.loadingDisconnect") : t("ocid.card.disconnect")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="cta"
              hierarchy="primary"
              size="small"
              onClick={handleConnect}
              disabled={loading || !isInitialized}
              leadingIcon={<img src={appPath("/logo/OC-square-logo.svg")} alt="" className="size-4 rounded-full" />}
            >
              {loading ? t("ocid.card.loadingConnect") : t("ocid.card.connect")}
            </Button>
          )
        }
      />

      {!isInitialized ? (
        <p role="status" className="text-body-medium text-foreground-subtle">{t("ocid.card.initializing")}</p>
      ) : authState.error ? (
        <p role="alert" className="text-body-medium text-destructive">{authState.error.message}</p>
      ) : null}

      {error ? <p role="alert" className="text-body-medium text-destructive">{error}</p> : null}
      {success ? <p role="status" className="text-body-medium text-success">{success}</p> : null}

      <Modal
        type="destructive"
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
        showCloseButton={false}
        closeLabel={tc("actions.close")}
        title={t("ocid.disconnectDialog.title")}
        description={
          mintedCount > 0
            ? t("ocid.disconnectDialog.bodyWithCredentials", { count: mintedCount })
            : t("ocid.disconnectDialog.body")
        }
        cancelLabel={t("common.cancel")}
        confirmLabel={t("ocid.disconnectDialog.confirm")}
        confirmDisabled={loading}
        onConfirm={() => void handleDisconnectConfirm()}
      >
        {mintedCount > 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            <p className="font-medium text-warning-foreground mb-1">
              {t("ocid.disconnectDialog.warningTitle")}
            </p>
            <p className="text-foreground-muted">
              {t("ocid.disconnectDialog.warningBody")}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
