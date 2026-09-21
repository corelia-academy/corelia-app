import { useQuery } from "@tanstack/react-query";
import { Github, Wallet, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWallets } from "@wallet-standard/app";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { availableSolanaWallets, connectEthereumWallet, connectSolanaWallet, getConnectedWallets, injectedEthereumWallet } from "@/lib/walletConnections";
import type { DiscoveredEthereumWallet, EthereumProvider } from "@/lib/walletConnections";
import { queryClient } from "@/lib/queryClient";
import { hasMyXpAward } from "@/lib/xp";

const OAUTH_XP_PENDING_KEY = "corelia.oauth-xp-pending";

export function ConnectedAccountsCard() {
  const { t } = useTranslation("account");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
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
  const identities = useQuery({
    queryKey: ["account", "identities"],
    queryFn: async () => {
      const { data, error: readError } = await supabase.auth.getUserIdentities();
      if (readError) throw readError;
      return data.identities;
    },
  });
  const githubConnected = identities.data?.some((identity) => identity.provider === "github") ?? false;
  const googleConnected = identities.data?.some((identity) => identity.provider === "google") ?? false;
  useEffect(() => {
    const raw = sessionStorage.getItem(OAUTH_XP_PENDING_KEY);
    if (!raw || !identities.data) return;
    let pending: { provider: "github" | "google"; hadAward: boolean | null; at: number };
    try { pending = JSON.parse(raw) as typeof pending; } catch { sessionStorage.removeItem(OAUTH_XP_PENDING_KEY); return; }
    if (Date.now() - pending.at > 10 * 60_000) { sessionStorage.removeItem(OAUTH_XP_PENDING_KEY); return; }
    if (!identities.data.some((identity) => identity.provider === pending.provider)) return;
    sessionStorage.removeItem(OAUTH_XP_PENDING_KEY);
    if (pending.provider === "github" && pending.hadAward === false) {
      void (async () => {
        await supabase.rpc("xp_sync_connections");
        if (await hasMyXpAward("github_connected")) {
          toast.success(t("xp.connections.githubXpEarned"));
          void queryClient.invalidateQueries({ queryKey: ["xp"] });
        }
      })().catch(() => undefined);
    }
  }, [identities.data, t]);
  const wallets = useQuery({ queryKey: ["account", "wallets"], queryFn: getConnectedWallets });

  async function connectWallet(action: () => Promise<boolean>) {
    setError(null);
    setWalletBusy(true);
    try {
      const awarded = await action();
      if (awarded) toast.success(t("xp.connections.walletXpEarned"));
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
    setConnecting(true);
    try {
      let hadAward: boolean | null = null;
      if (provider === "github") hadAward = await hasMyXpAward("github_connected").catch(() => null);
      sessionStorage.setItem(OAUTH_XP_PENDING_KEY, JSON.stringify({ provider, hadAward, at: Date.now() }));
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/account/profile` },
      });
      if (linkError) throw linkError;
    } catch (cause) {
      sessionStorage.removeItem(OAUTH_XP_PENDING_KEY);
      setError(cause instanceof Error ? cause.message : t("xp.connections.failed"));
      setConnecting(false);
    }
  }

  return <section className="rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card">
    <h2 className="font-display text-heading-medium">{t("xp.connections.title")}</h2>
    <p className="mt-1 text-sm text-foreground-muted">{t("xp.connections.description")}</p>
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
      <div className="flex items-center gap-2"><Github className="size-5" aria-hidden /><span className="font-medium">GitHub</span></div>
      {identities.isPending ? <span className="text-sm text-foreground-muted">{t("xp.loading")}</span> : githubConnected ? <span className="text-sm text-primary">{t("xp.connections.connected")}</span> : <button type="button" disabled={connecting} onClick={() => void connectIdentity("github")} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{connecting ? t("xp.loading") : t("xp.connections.connectGithub")}</button>}
    </div>
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
      <div className="flex items-center gap-2"><Mail className="size-5" aria-hidden /><span className="font-medium">Google</span></div>
      {identities.isPending ? <span className="text-sm text-foreground-muted">{t("xp.loading")}</span> : googleConnected ? <span className="text-sm text-primary">{t("xp.connections.connected")}</span> : <button type="button" disabled={connecting} onClick={() => void connectIdentity("google")} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{connecting ? t("xp.loading") : t("xp.connections.connectGoogle")}</button>}
    </div>
    <div className="mt-3 space-y-2 rounded-xl border border-border-subtle p-3">
      <div className="flex items-center gap-2 font-medium"><Wallet className="size-5" aria-hidden />Ethereum</div>
      {ethereumWallets.length === 0 ? <p className="text-sm text-foreground-muted">{t("xp.connections.noEthereumWallet")}</p> : ethereumWallets.map((wallet) => <button key={wallet.id} type="button" disabled={walletBusy} onClick={() => void connectWallet(() => connectEthereumWallet(wallet.provider))} className="mr-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{t("xp.connections.connectEthereum", { wallet: wallet.name })}</button>)}
      {wallets.data?.filter((wallet) => wallet.chain === "ethereum").map((wallet) => <p key={wallet.id} className="break-all text-xs text-foreground-muted">{wallet.address}</p>)}
    </div>
    <div className="mt-3 space-y-2 rounded-xl border border-border-subtle p-3">
      <div className="flex items-center gap-2 font-medium"><Wallet className="size-5" aria-hidden />Solana</div>
      {solanaWallets.length === 0 ? <p className="text-sm text-foreground-muted">{t("xp.connections.noSolanaWallet")}</p> : solanaWallets.map((wallet) => <button key={wallet.name} type="button" disabled={walletBusy} onClick={() => void connectWallet(() => connectSolanaWallet(wallet))} className="mr-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{t("xp.connections.connectSolana", { wallet: wallet.name })}</button>)}
      {wallets.data?.filter((wallet) => wallet.chain === "solana").map((wallet) => <p key={wallet.id} className="break-all text-xs text-foreground-muted">{wallet.address}</p>)}
    </div>
    {identities.isError ? <button type="button" onClick={() => void identities.refetch()} className="mt-2 text-sm text-primary underline">{t("profile.retry")}</button> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
  </section>;
}
