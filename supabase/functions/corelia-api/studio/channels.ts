// Allowed YouTube channels for AI course video lessons and suggestions.

export interface AllowedChannel {
  name: string;
  handle: string; // e.g. "@freecodecamp", lowercase with leading @
  tracks: readonly string[];
}

export const ALLOWED_CHANNELS: readonly AllowedChannel[] = [
  { name: "freeCodeCamp.org", handle: "@freecodecamp", tracks: ["ai-engineer", "backend", "devops", "full-stack", "nextjs", "react", "solana", "vibe-coding"] },
  { name: "Programming with Mosh", handle: "@programmingwithmosh", tracks: ["backend", "full-stack", "nextjs", "react"] },
  { name: "Traversy Media", handle: "@traversymedia", tracks: ["backend", "full-stack", "nextjs", "react"] },
  { name: "Net Ninja", handle: "@netninja", tracks: ["backend", "full-stack", "nextjs", "react"] },
  { name: "Web Dev Simplified", handle: "@webdevsimplified", tracks: ["backend", "full-stack", "nextjs", "react"] },
  { name: "Academind", handle: "@academind", tracks: ["backend", "full-stack", "nextjs", "react"] },
  { name: "Patrick Collins", handle: "@patrickalphac", tracks: ["ethereum", "web3-security"] },
  { name: "Chainlink", handle: "@chainlink", tracks: ["ethereum", "solana", "web3-security"] },
  { name: "Ethereum Foundation", handle: "@ethereumfoundation", tracks: ["ethereum", "web3-security"] },
  { name: "Smart Contract Programmer", handle: "@smartcontractprogrammer", tracks: ["ethereum", "web3-security"] },
  { name: "Let's Get Rusty", handle: "@letsgetrusty", tracks: ["backend", "solana"] },
  { name: "3Blue1Brown", handle: "@3blue1brown", tracks: ["ai-engineer"] },
  { name: "Google for Developers", handle: "@googledevelopers", tracks: ["ai-engineer", "devops", "full-stack"] },
  { name: "ByteByteGo", handle: "@bytebytego", tracks: ["backend", "devops", "full-stack"] },
  { name: "NeetCode", handle: "@neetcode", tracks: ["backend"] },
  { name: "GitHub", handle: "@github", tracks: ["devops", "vibe-coding"] },
  { name: "CNCF [Cloud Native Computing Foundation]", handle: "@cncf", tracks: ["backend", "devops"] },
  { name: "Anthropic", handle: "@anthropic-ai", tracks: ["ai-engineer", "vibe-coding"] },
  { name: "OpenAI", handle: "@openai", tracks: ["ai-engineer", "vibe-coding"] },
  { name: "DeepLearningAI", handle: "@deeplearningai", tracks: ["ai-engineer", "vibe-coding"] },
  { name: "LangChain", handle: "@langchain", tracks: ["ai-engineer"] },
  { name: "Hugging Face", handle: "@huggingface", tracks: ["ai-engineer"] },
  { name: "Andrej Karpathy", handle: "@andrejkarpathy", tracks: ["ai-engineer"] },
  { name: "Cursor", handle: "@cursor_ai", tracks: ["ai-engineer", "vibe-coding"] },
  { name: "Solana", handle: "@solana", tracks: ["solana"] },
  { name: "Quicknode", handle: "@quicknode", tracks: ["ethereum", "solana"] },
  { name: "Alchemy", handle: "@alchemyplatform", tracks: ["ethereum", "solana"] },
  { name: "Cyfrin Audits", handle: "@cyfrinaudits", tracks: ["ethereum", "web3-security"] },
  { name: "OpenZeppelin", handle: "@openzeppelin", tracks: ["ethereum", "web3-security"] },
  { name: "Hussein Nasser", handle: "@hnasr", tracks: ["backend", "devops"] },
  { name: "CMU Database Group", handle: "@cmudatabasegroup", tracks: ["backend"] },
  { name: "Supabase", handle: "@supabase", tracks: ["backend", "full-stack", "vibe-coding"] },
  { name: "Prisma", handle: "@prismadata", tracks: ["backend", "full-stack", "nextjs"] },
  { name: "PlanetScale", handle: "@planetscale", tracks: ["backend"] },
  { name: "Neon Postgres", handle: "@neondatabase", tracks: ["backend", "full-stack"] },
  { name: "ArjanCodes", handle: "@arjancodes", tracks: ["ai-engineer", "backend"] },
  { name: "Corey Schafer", handle: "@coreyms", tracks: ["ai-engineer", "backend"] },
  { name: "Vercel", handle: "@vercelhq", tracks: ["full-stack", "nextjs", "react", "vibe-coding"] },
  { name: "Matt Pocock", handle: "@mattpocockuk", tracks: ["backend", "full-stack", "nextjs", "react"] },
  { name: "Jack Herrington", handle: "@jherr", tracks: ["full-stack", "nextjs", "react"] },
  { name: "Fireship", handle: "@fireship", tracks: ["full-stack", "nextjs", "react", "vibe-coding"] },
  { name: "Docker", handle: "@dockerinc", tracks: ["backend", "devops", "full-stack"] },
  { name: "TechWorld with Nana", handle: "@techworldwithnana", tracks: ["devops"] },
  { name: "KodeKloud", handle: "@kodekloud", tracks: ["devops"] },
  { name: "Cloudflare", handle: "@cloudflare", tracks: ["backend", "devops", "full-stack"] },
  { name: "NetworkChuck", handle: "@networkchuck", tracks: ["backend", "devops"] },
  { name: "Computerphile", handle: "@computerphile", tracks: ["ai-engineer", "backend", "web3-security"] },
  { name: "CS50", handle: "@cs50", tracks: ["backend", "full-stack"] },
  { name: "MIT OpenCourseWare", handle: "@mitocw", tracks: ["ai-engineer", "backend"] },
] as const;

/** Returns approved channels tagged for a track, falling back to all channels if track is empty or unknown. */
export function channelsForTrack(track?: string | null): readonly AllowedChannel[] {
  const key = track?.trim().toLowerCase();
  if (!key) return ALLOWED_CHANNELS;
  const matched = ALLOWED_CHANNELS.filter((c) => c.tracks.includes(key));
  return matched.length > 0 ? matched : ALLOWED_CHANNELS;
}

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
