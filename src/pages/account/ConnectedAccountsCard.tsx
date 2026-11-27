import { useLocation, useNavigate } from "react-router-dom";
import { readAccountConnectionError } from "@/lib/accountConnectionCallback";
import { useQuery } from "@tanstack/react-query";
import { GithubLogo, GoogleLogo, Wallet } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getWallets } from "@wallet-standard/app";

import { connectAccountIdentity } from "@/lib/auth";
import { useAuth } from "@/stores/authStore";
import { connectedIdentitiesQueryOptions, connectedWalletsQueryOptions } from "@/features/account/accountQueries";
import { availableSolanaWallets, connectEthereumWallet, connectSolanaWallet, disconnectWallet, injectedEthereumWallet } from "@/lib/walletConnections";
import type { ConnectedWallet } from "@/lib/walletConnections";
import { Modal } from "@/components/ui/modal";
import { SettingsRow } from "./SettingsLayout";
import type { DiscoveredEthereumWallet, EthereumProvider } from "@/lib/walletConnections";
import { queryClient } from "@/lib/queryClient";


export function ConnectedAccountsCard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [callbackError, setCallbackError] = useState(() => readAccountConnectionError(location.search, location.hash));
  useEffect(() => {
    const callback = readAccountConnectionError(location.search, location.hash);
    if (callback) navigate({ pathname: location.pathname, search: callback.search, hash: callback.hash }, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);
  const { t } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [addingWallet, setAddingWallet] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<ConnectedWallet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [solanaWallets, setSolanaWallets] = useState(availableSolanaWallets);
  const [ethereumWallets, setEthereumWallets] = useState<DiscoveredEthereumWallet[]>(() => {
    const fallback = injectedEthereumWallet();
    return fallback ? [fallback] : [];
  });
  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<{ info?: { uuid?: string; name?: string }; provider?: EthereumProvider }>).detail;
      if (!detail?.info?.uuid || !detail.provider?.request) return;
      const id = detail.info.uuid;
      const name = detail.info.name || "Ethereum";
      const provider = detail.provider;
      setEthereumWallets((previous) => {
        const discovered = previous.filter((item) => item.id !== "injected");
        if (discovered.some((item) => item.id === id)) return previous;
        return [...discovered, { id, name, provider }];
      });
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, []);
  useEffect(() => {
    const wallets = getWallets();
    const update = () => setSolanaWallets(availableSolanaWallets());
    const offRegister = wallets.on("register", update);
    const offUnregister = wallets.on("unregister", update);
    return () => { offRegister(); offUnregister(); };
  }, []);
  const identities = useQuery(connectedIdentitiesQueryOptions(user?.id));
  const githubIdentity = identities.data?.find((identity) => identity.provider === "github");
  const googleIdentity = identities.data?.find((identity) => identity.provider === "google");
  const wallets = useQuery(connectedWalletsQueryOptions(user?.id));

  async function confirmDisconnect() {
    if (!unlinking) return;
    setError(null);
    setNotice(null);
    setWalletBusy(true);
    try {
      await disconnectWallet(unlinking);
      setUnlinking(null);
      setNotice(t("xp.connections.walletDisconnected"));
      await queryClient.invalidateQueries({ queryKey: ["account", "wallets"] });
    } catch {
      setUnlinking(null);
      setError(t("xp.connections.failed"));
    } finally {
      setWalletBusy(false);
    }
  }

  async function connectWallet(action: () => Promise<boolean>) {
    setError(null);
    setCallbackError(null);
    setWalletBusy(true);
    try {
      await action();
      setAddingWallet(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "wallets"] }),
        queryClient.invalidateQueries({ queryKey: ["xp"] }),
      ]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const known: Record<string, string> = {
        wallet_missing: t("xp.connections.errors.wallet_missing"),
        invalid_signature: t("xp.connections.errors.invalid_signature"),
        challenge_expired: t("xp.connections.errors.challenge_expired"),
        wallet_linked_to_another_account: t("xp.connections.errors.wallet_linked_to_another_account"),
        origin_mismatch: t("xp.connections.errors.origin_mismatch"),
        unauthenticated: t("xp.connections.errors.unauthenticated"),
      };
      setError(known[message] ?? (/^[a-z_]+$/.test(message) ? t("xp.connections.failed") : message || t("xp.connections.failed")));
    } finally {
      setWalletBusy(false);
    }
  }

  async function connectIdentity(provider: "github" | "google") {
    setError(null);
    setCallbackError(null);
    setConnecting(true);
    try {
      await connectAccountIdentity(provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("xp.connections.failed"));
      setConnecting(false);
    }
  }

  const identityRows = [
    { provider: "github" as const, name: "GitHub", Icon: GithubLogo, identity: githubIdentity, detail: githubIdentity?.identity_data?.user_name || githubIdentity?.identity_data?.email, connectLabel: t("xp.connections.connectGithub") },
    { provider: "google" as const, name: "Google", Icon: GoogleLogo, identity: googleIdentity, detail: googleIdentity?.identity_data?.email, connectLabel: t("xp.connections.connectGoogle") },
  ];

  return <div className="flex flex-col gap-5">
    {callbackError ? <p role="alert" className="text-body-medium text-destructive">{t(callbackError.messageKey)}</p> : null}
    {identityRows.map(({ provider, name, Icon, identity, detail, connectLabel }) => (
      <div key={provider} id={provider === "github" ? "connected-github" : undefined} tabIndex={provider === "github" ? -1 : undefined} className="rounded-md">
        <SettingsRow
          leading={<Icon className="size-5 shrink-0" weight="duotone" aria-hidden />}
          title={name}
          description={identities.isSuccess ? identity ? detail : t("xp.connections.notConnected") : undefined}
          action={
            identities.isPending ? <span className="text-body-medium text-foreground-subtle">{t("xp.connections.loading")}</span>
              : identities.isError ? <span className="text-body-medium text-destructive">{t("xp.connections.loadFailed")}</span>
                : identity ? <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled>{t("xp.connections.connected")}</Button>
                  : <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={connecting} onClick={() => void connectIdentity(provider)}>{connecting ? t("xp.connections.loading") : connectLabel}</Button>
          }
        />
      </div>
    ))}
    {identities.isError ? <div><Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => void identities.refetch()}>{t("profile.retry")}</Button></div> : null}
    {(["ethereum", "solana"] as const).map((chain) => {
      const linked = wallets.data?.filter((wallet) => wallet.chain === chain) ?? [];
      return <div key={chain} id={`connected-${chain}`} tabIndex={-1} className="flex flex-col gap-3 rounded-md">
        <SettingsRow
          leading={<Wallet className="size-5 shrink-0" weight="duotone" aria-hidden />}
          title={chain === "ethereum" ? "Ethereum" : "Solana"}
          description={wallets.isPending ? t("xp.connections.loading") : wallets.isError ? t("xp.connections.loadFailed") : linked.length ? t("xp.connections.walletCount", { count: linked.length }) : t("xp.connections.notConnected")}
          action={
            wallets.isError ? <Button type="button" variant="cta" hierarchy="secondary" size="small" onClick={() => void wallets.refetch()}>{t("profile.retry")}</Button>
              : !wallets.isPending ? <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={walletBusy} aria-expanded={addingWallet === chain} onClick={() => setAddingWallet(addingWallet === chain ? null : chain)}>{t(linked.length ? "xp.connections.addWallet" : "xp.connections.chooseWallet")}</Button>
                : undefined
          }
        />
        {linked.map((wallet) => <div key={wallet.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stroke-divider px-3 py-2">
          <p className="min-w-0 break-all font-mono text-body-medium">{wallet.address}</p>
          <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={walletBusy} onClick={() => setUnlinking(wallet)}>{t("xp.connections.walletDisconnect")}</Button>
        </div>)}
        {addingWallet === chain && !wallets.isError && !wallets.isPending ? <div className="flex flex-wrap justify-end gap-2">
          {chain === "ethereum" ? ethereumWallets.length === 0 ? <p className="text-body-medium text-foreground-subtle">{t("xp.connections.noEthereumWallet")}</p> : ethereumWallets.map((wallet) => <Button key={wallet.id} type="button" variant="cta" hierarchy="secondary" size="small" disabled={walletBusy} onClick={() => void connectWallet(() => connectEthereumWallet(wallet.provider))}>{wallet.name}</Button>) : solanaWallets.length === 0 ? <p className="text-body-medium text-foreground-subtle">{t("xp.connections.noSolanaWallet")}</p> : solanaWallets.map((wallet) => <Button key={wallet.name} type="button" variant="cta" hierarchy="secondary" size="small" disabled={walletBusy} onClick={() => void connectWallet(() => connectSolanaWallet(wallet))}>{wallet.name}</Button>)}
          {walletBusy ? <p role="status" className="w-full text-body-medium text-foreground-subtle">{t("xp.connections.confirmWallet")}</p> : null}
        </div> : null}
      </div>;
    })}
    {error ? <p role="alert" className="text-body-medium text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-body-medium text-success">{notice}</p> : null}
    <Modal
      type="destructive"
      open={unlinking !== null}
      onOpenChange={(open) => { if (!open && !walletBusy) setUnlinking(null); }}
      title={t("xp.connections.walletDisconnectTitle")}
      description={t("xp.connections.walletDisconnectBody")}
      cancelLabel={t("xp.connections.walletDisconnectCancel")}
      confirmLabel={t("xp.connections.walletDisconnectConfirm")}
      closeLabel={tc("actions.close")}
      confirmDisabled={walletBusy}
      onConfirm={() => void confirmDisconnect()}
    >
      {unlinking ? <p className="break-all rounded-md bg-surface-raised p-3 font-mono text-body-medium">{unlinking.address}</p> : null}
    </Modal>
  </div>;
}
