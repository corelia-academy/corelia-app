import type { MintNetwork } from "./settings.ts";

/** Link an email recipient to the exact credential just minted by Open Campus. */
export function credentialExplorerUrl(params: {
  credentialId: string;
  holderOcid: string | null;
  network: MintNetwork;
  isBadge: boolean;
}): string {
  const base = params.network === "staging"
    ? "https://id.sandbox.opencampus.xyz"
    : "https://id.opencampus.xyz";
  const id = encodeURIComponent(params.credentialId.trim());
  const holder = params.holderOcid?.trim();
  if (!holder) return `${base}/public/credentials?id=${id}`;
  const username = holder.endsWith(".edu") ? holder : `${holder}.edu`;
  const collection = params.isBadge ? "ocbadge" : "occredential";
  return `${base}/public/credentials/details?username=${encodeURIComponent(username)}&id=${id}&nftCollection=${collection}`;
}
