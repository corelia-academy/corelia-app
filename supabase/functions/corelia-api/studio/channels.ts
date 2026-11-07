// Allowed YouTube channels for AI course video lessons and suggestions (approved 2026-11-01).

export interface AllowedChannel {
  name: string;
  handle: string; // e.g. "@freecodecamp", lowercase with leading @
}

export const ALLOWED_CHANNELS: readonly AllowedChannel[] = [
  { name: "freeCodeCamp.org", handle: "@freecodecamp" },
  { name: "Programming with Mosh", handle: "@programmingwithmosh" },
  { name: "Traversy Media", handle: "@traversymedia" },
  { name: "Net Ninja", handle: "@netninja" },
  { name: "Web Dev Simplified", handle: "@webdevsimplified" },
  { name: "Academind", handle: "@academind" },
  { name: "Patrick Collins", handle: "@patrickalphac" },
  { name: "Chainlink", handle: "@chainlink" },
  { name: "Ethereum Foundation", handle: "@ethereumfoundation" },
  { name: "Smart Contract Programmer", handle: "@smartcontractprogrammer" },
  { name: "Let's Get Rusty", handle: "@letsgetrusty" },
  { name: "3Blue1Brown", handle: "@3blue1brown" },
  { name: "Google for Developers", handle: "@googledevelopers" },
  { name: "ByteByteGo", handle: "@bytebytego" },
  { name: "NeetCode", handle: "@neetcode" },
  { name: "GitHub", handle: "@github" },
  { name: "CNCF [Cloud Native Computing Foundation]", handle: "@cncf" },
] as const;

/** Canonical normalization for channel names: NFKC, ASCII quotes, collapsed whitespace, lowercase. */
export function normalizeChannelName(value: string): string {
  return value.normalize("NFKC").trim().replace(/['’]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

/** Extracts the channel handle (@name) from an author_url (e.g. https://www.youtube.com/@freecodecamp). */
export function extractChannelHandle(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const match = url.trim().match(/@([a-zA-Z0-9_.-]+)/);
  return match ? `@${match[1].toLowerCase()}` : null;
}

const CHANNELS_BY_HANDLE = new Map<string, AllowedChannel>(
  ALLOWED_CHANNELS.map((c) => [c.handle.toLowerCase(), c]),
);

/** Finds an allowed channel by research channel name or known alias (e.g. "CNCF"). */
export function findAllowedChannelByName(name: string): AllowedChannel | undefined {
  if (!name || typeof name !== "string") return undefined;
  const key = normalizeChannelName(name);
  if (key === "cncf") {
    return CHANNELS_BY_HANDLE.get("@cncf");
  }
  return ALLOWED_CHANNELS.find((c) => normalizeChannelName(c.name) === key);
}

/** Finds an allowed channel by handle (case-insensitive, with or without leading @). */
export function findChannelByHandle(handle: string): AllowedChannel | undefined {
  if (!handle || typeof handle !== "string") return undefined;
  const h = handle.trim().toLowerCase();
  const normalizedHandle = h.startsWith("@") ? h : `@${h}`;
  return CHANNELS_BY_HANDLE.get(normalizedHandle);
}

/** Returns true if the channel name (or alias) matches an allowed channel. */
export function isAllowedChannel(name: string): boolean {
  return findAllowedChannelByName(name) !== undefined;
}
