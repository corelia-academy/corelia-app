import { useLocation, useNavigate } from "react-router-dom";
import { readAccountConnectionError } from "@/lib/accountConnectionCallback";
import { useQuery } from "@tanstack/react-query";
import { Github, Wallet, Mail, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getWallets } from "@wallet-standard/app";

import { connectAccountIdentity } from "@/lib/auth";
import { useAuth } from "@/stores/authStore";
import { connectedIdentitiesQueryOptions, connectedWalletsQueryOptions } from "@/features/account/accountQueries";
import { availableSolanaWallets, connectEthereumWallet, connectSolanaWallet, injectedEthereumWallet } from "@/lib/walletConnections";
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
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [addingWallet, setAddingWallet] = useState<string | null>(null);
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
        wallet_already_linked_or_challenge_expired: t("xp.connections.errors.wallet_already_linked_or_challenge_expired"),
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

  return <section className="rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card">
    <h2 className="font-display text-heading-medium">{t("xp.connections.title")}</h2>
    {callbackError ? <p role="alert" className="mt-3 rounded-lg border border-destructive p-3 text-sm text-destructive">{t(callbackError.messageKey)}</p> : null}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
      <div className="flex items-center gap-2"><Github className="size-5" aria-hidden /><div><span className="font-medium">GitHub</span><p className="break-all text-xs text-foreground-muted">{identities.isSuccess ? githubIdentity ? githubIdentity.identity_data?.user_name || githubIdentity.identity_data?.email : t("xp.connections.notConnected") : null}</p></div></div>
      {identities.isPending ? <span className="text-sm text-foreground-muted">{t("xp.connections.loading")}</span> : identities.isError ? <span className="text-sm text-destructive">{t("xp.connections.loadFailed")}</span> : githubIdentity ? <span className="text-sm text-primary">{t("xp.connections.connected")}</span> : <button type="button" disabled={connecting} onClick={() => void connectIdentity("github")} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{connecting ? t("xp.connections.loading") : t("xp.connections.connectGithub")}</button>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
      <div className="flex items-center gap-2"><Mail className="size-5" aria-hidden /><div><span className="font-medium">Google</span><p className="break-all text-xs text-foreground-muted">{identities.isSuccess ? googleIdentity ? googleIdentity.identity_data?.email : t("xp.connections.notConnected") : null}</p></div></div>
      {identities.isPending ? <span className="text-sm text-foreground-muted">{t("xp.connections.loading")}</span> : identities.isError ? <span className="text-sm text-destructive">{t("xp.connections.loadFailed")}</span> : googleIdentity ? <span className="text-sm text-primary">{t("xp.connections.connected")}</span> : <button type="button" disabled={connecting} onClick={() => void connectIdentity("google")} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{connecting ? t("xp.connections.loading") : t("xp.connections.connectGoogle")}</button>}
    </div>
    {(["ethereum", "solana"] as const).map((chain) => {
      const linked = wallets.data?.filter((wallet) => wallet.chain === chain) ?? [];
      const name = chain === "ethereum" ? "Ethereum" : "Solana";
      return <div key={chain} className="mt-3 space-y-3 rounded-xl border border-border-subtle p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium"><Wallet className="size-5" aria-hidden />{name}</div>
          <span className="flex items-center gap-1.5 text-sm text-foreground-muted">
            {linked.length > 0 && !wallets.isError ? <CheckCircle2 className="size-4 text-primary" aria-hidden /> : null}
            {wallets.isPending ? t("xp.connections.loading") : wallets.isError ? t("xp.connections.loadFailed") : linked.length ? t("xp.connections.walletCount", { count: linked.length }) : t("xp.connections.notConnected")}
          </span>
        </div>
        {linked.map((wallet) => <p key={wallet.id} className="break-all rounded-lg bg-surface-raised p-3 font-mono text-sm">{wallet.address}</p>)}
        {wallets.isError ? <Button type="button" variant="outline" onClick={() => void wallets.refetch()}>{t("profile.retry")}</Button> : !wallets.isPending ? <>
          <Button type="button" variant="outline" disabled={walletBusy} aria-expanded={addingWallet === chain} onClick={() => setAddingWallet(addingWallet === chain ? null : chain)}>{t(linked.length ? "xp.connections.addWallet" : "xp.connections.chooseWallet")}</Button>
          {addingWallet === chain ? <div className="flex flex-wrap gap-2">
            {chain === "ethereum" ? ethereumWallets.length === 0 ? <p className="text-sm text-foreground-muted">{t("xp.connections.noEthereumWallet")}</p> : ethereumWallets.map((wallet) => <Button key={wallet.id} type="button" variant="secondary" disabled={walletBusy} onClick={() => void connectWallet(() => connectEthereumWallet(wallet.provider))}>{wallet.name}</Button>) : solanaWallets.length === 0 ? <p className="text-sm text-foreground-muted">{t("xp.connections.noSolanaWallet")}</p> : solanaWallets.map((wallet) => <Button key={wallet.name} type="button" variant="secondary" disabled={walletBusy} onClick={() => void connectWallet(() => connectSolanaWallet(wallet))}>{wallet.name}</Button>)}
            {walletBusy ? <p role="status" className="w-full text-sm text-foreground-muted">{t("xp.connections.confirmWallet")}</p> : null}
          </div> : null}
        </> : null}
      </div>;
    })}
    {identities.isError ? <button type="button" onClick={() => void identities.refetch()} className="mt-2 text-sm text-primary underline">{t("profile.retry")}</button> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
  </section>;
}
