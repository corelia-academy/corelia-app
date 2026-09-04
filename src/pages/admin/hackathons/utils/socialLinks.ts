export type HackathonSocialNetwork = "telegram" | "x" | "facebook";

const allowedHosts: Record<HackathonSocialNetwork, readonly string[]> = {
  telegram: ["t.me", "telegram.me"],
  x: ["x.com", "twitter.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
};

const TELEGRAM_USERNAME = /^@([a-zA-Z0-9_]{5,32})$/;

function matchesAllowedHost(hostname: string, network: HackathonSocialNetwork) {
  const normalizedHostname = hostname.toLowerCase();
  return allowedHosts[network].some(
    (allowedHost) => normalizedHostname === allowedHost || normalizedHostname.endsWith(`.${allowedHost}`),
  );
}

export function normalizeHackathonSocialLink(
  network: HackathonSocialNetwork,
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (network === "telegram") {
    const username = trimmed.match(TELEGRAM_USERNAME)?.[1];
    if (username) return `https://t.me/${username}`;
  }

  return trimmed;
}

export function isValidHackathonSocialLink(
  network: HackathonSocialNetwork,
  value: string,
) {
  const normalized = normalizeHackathonSocialLink(network, value);
  if (!normalized) return true;

  try {
    const url = new URL(normalized);
    return (
      (url.protocol === "https:" || url.protocol === "http:")
      && matchesAllowedHost(url.hostname, network)
      && url.pathname !== "/"
    );
  } catch {
    return false;
  }
}
