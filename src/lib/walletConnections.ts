import bs58 from "bs58";
import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";

import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";

export type ConnectedWallet = { id: string; chain: "ethereum" | "solana"; address: string; verified_at: string };
export type EthereumProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
export type DiscoveredEthereumWallet = { id: string; name: string; provider: EthereumProvider };

export async function getConnectedWallets(): Promise<ConnectedWallet[]> {
  const { data, error } = await supabase.from("connected_wallets")
    .select("id,chain,address,verified_at").order("verified_at", { ascending: true });
  if (error) throw error;
  return data as ConnectedWallet[];
}

export function availableSolanaWallets(): Wallet[] {
  return getWallets().get().filter((wallet) => Boolean(wallet.features["standard:connect"] && wallet.features["solana:signMessage"]));
}

export function injectedEthereumWallet(): DiscoveredEthereumWallet | null {
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return provider ? { id: "injected", name: "Ethereum", provider } : null;
}

export async function connectEthereumWallet(injected: EthereumProvider): Promise<boolean> {
  if (!injected) throw new Error("wallet_missing");
  const accounts = await injected.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  if (!address) throw new Error("wallet_missing");
  const { challengeId, message } = await callCoreliaApi<{ challengeId: string; message: string }>("wallets.challenge", { chain: "ethereum", address });
  const signature = await injected.request({ method: "personal_sign", params: [message, address] });
  if (typeof signature !== "string") throw new Error("invalid_signature");
  const result = await callCoreliaApi<{ linked: boolean; awarded: boolean }>("wallets.verify", { challengeId, signature });
  return result.awarded;
}

export async function connectSolanaWallet(wallet: Wallet): Promise<boolean> {
  const connect = wallet.features["standard:connect"] as { connect(): Promise<{ accounts: readonly { address: string }[] }> } | undefined;
  const sign = wallet.features["solana:signMessage"] as { signMessage(input: { account: unknown; message: Uint8Array }): Promise<readonly { signedMessage: Uint8Array; signature: Uint8Array }[]> } | undefined;
  if (!connect || !sign) throw new Error("wallet_missing");
  const { accounts } = await connect.connect();
  const account = accounts.find((item) => item.address && wallet.accounts.some((candidate) => candidate.address === item.address));
  if (!account) throw new Error("wallet_missing");
  const { challengeId, message } = await callCoreliaApi<{ challengeId: string; message: string }>("wallets.challenge", { chain: "solana", address: account.address });
  const [result] = await sign.signMessage({ account, message: new TextEncoder().encode(message) });
  if (!result) throw new Error("invalid_signature");
  const verified = await callCoreliaApi<{ linked: boolean; awarded: boolean }>("wallets.verify", { challengeId, signature: bs58.encode(result.signature), signedMessage: bs58.encode(result.signedMessage) });
  return verified.awarded;
}
