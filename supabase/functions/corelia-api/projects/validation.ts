export const PROJECT_MEDIA_BUCKET = "app";
export const PROJECT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const PROJECT_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const PROJECT_SCREENSHOT_LIMIT = 6;

export type ProjectMediaKind = "logo" | "screenshot";
export type ProjectLinkField = "demo_url" | "repo_url" | "slide_url";

export type ProjectLink = {
  field: ProjectLinkField;
  url: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function normalizeProjectSlug(value: unknown): string {
  const slug = String(value ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) throw new Error("invalid_input:project_slug");
  return slug;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

function isUnsafeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const firstIpv6Hextet = host.includes(":")
    ? Number.parseInt(host.split(":", 1)[0] || "0", 16)
    : Number.NaN;
  const isUnsafeIpv6 = host.includes(":") && (
    host === "::"
    || host === "::1"
    || host.includes(".")
    || (Number.isInteger(firstIpv6Hextet) && (firstIpv6Hextet & 0xfe00) === 0xfc00)
    || (Number.isInteger(firstIpv6Hextet) && (firstIpv6Hextet & 0xffc0) === 0xfe80)
  );
  return host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || isUnsafeIpv6
    || isPrivateIpv4(host);
}

export function normalizeHttpsUrl(field: string, value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`invalid_url:${field}`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || isUnsafeHostname(parsed.hostname)) {
    throw new Error(`invalid_url:${field}`);
  }
  return parsed.toString();
}

export function validateProjectLinks(values: {
  demo_url?: unknown;
  repo_url?: unknown;
  slide_url?: unknown;
}): ProjectLink[] {
  const links: ProjectLink[] = [];
  const demo = normalizeHttpsUrl("demo_url", values.demo_url);
  const repo = normalizeHttpsUrl("repo_url", values.repo_url);
  const slide = normalizeHttpsUrl("slide_url", values.slide_url);
  if (demo) links.push({ field: "demo_url", url: demo });
  if (slide) links.push({ field: "slide_url", url: slide });
  if (repo) {
    const parsed = new URL(repo);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parsed.hostname.toLowerCase() !== "github.com" || parts.length !== 2) {
      throw new Error("invalid_url:repo_url");
    }
    links.push({ field: "repo_url", url: repo });
  }
  return links;
}

export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function imageExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function projectMediaPath(args: {
  ownerId: string;
  projectId: string;
  kind: ProjectMediaKind;
  objectId: string;
  mime: string;
}): string {
  const folder = args.kind === "logo" ? "logo" : "screenshots";
  return `project-media/${args.ownerId}/${args.projectId}/${folder}/${args.objectId}.${imageExtension(args.mime)}`;
}

export function isOwnedProjectMediaPath(path: string, ownerId: string, projectId?: string): boolean {
  const prefix = projectId
    ? `project-media/${ownerId}/${projectId}/`
    : `project-media/${ownerId}/`;
  return path.startsWith(prefix) && !path.includes("..") && !path.includes("//");
}
