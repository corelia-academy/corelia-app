export type OgWorkerEnv = {
  OG_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  CORELIA_OG_FUNCTION_URL?: string;
  CORELIA_APP_ORIGIN?: string;
  OG_PROXY_SECRET?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
};

type RewriteTag = { before(content: string, options: { html: boolean }): void };
type RewriteElement = {
  setInnerContent(content: string): void;
  setAttribute(name: string, value: string): void;
  remove(): void;
  onEndTag(handler: (tag: RewriteTag) => void): void;
};
declare const HTMLRewriter: {
  new(): {
    on(selector: string, handler: { element(element: RewriteElement): void }): InstanceType<typeof HTMLRewriter>;
    transform(response: Response): Response;
  };
};

type Entity = "project" | "course" | "hackathon" | "profile";
type Metadata = {
  canonicalUrl: string; imageUrl: string; updatedAt: string; revision: string;
  title: string; description: string; imageAlt: string;
};
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function ogRoute(path: string): { entity: Entity; id: string; meta: boolean } | null {
  const match = path.match(/^\/api\/og\/(project|course|hackathon|profile)\/([^/]+?)(\/meta)?\/?$/);
  if (!match) return null;
  try { return { entity: match[1] as Entity, id: decodeURIComponent(match[2]), meta: Boolean(match[3]) }; }
  catch { return null; }
}

function pageRoute(path: string): { entity: Entity; id: string } | null {
  const match = path.match(/^\/(?:projects\/([^/]+)|courses\/([^/]+)|hackathons\/([^/]+)|(?:@|%40)([^/]+))\/?$/i);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1] ?? match[2] ?? match[3] ?? match[4]);
    if (!id || id === "new") return null;
    return { entity: match[1] ? "project" : match[2] ? "course" : match[3] ? "hackathon" : "profile", id };
  } catch { return null; }
}

function noStore(response: Response, robots?: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  if (robots) headers.set("X-Robots-Tag", robots);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function edge(env: OgWorkerEnv, entity: Entity, action: "meta" | "image", id: string,
  method: "GET" | "HEAD" = "GET", revision?: string): Promise<Response> {
  if (!env.CORELIA_OG_FUNCTION_URL || !env.OG_PROXY_SECRET) throw new Error("OG Worker unconfigured");
  const url = new URL(env.CORELIA_OG_FUNCTION_URL);
  url.searchParams.set("op", `og.${entity}.${action}`);
  url.searchParams.set("id", id);
  if (revision) url.searchParams.set("v", revision);
  return fetch(url, { method, headers: { "x-corelia-og-proxy-secret": env.OG_PROXY_SECRET },
    redirect: "manual", signal: AbortSignal.timeout(action === "image" ? 12000 : 4000) });
}

async function metadata(env: OgWorkerEnv, entity: Entity, id: string): Promise<Metadata | null> {
  const response = await edge(env, entity, "meta", id);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`OG metadata ${response.status}`);
  const data = await response.json() as Metadata;
  const origin = new URL(env.CORELIA_APP_ORIGIN ?? "").origin;
  if (new URL(data.canonicalUrl).origin !== origin || new URL(data.imageUrl).origin !== origin) {
    throw new Error("OG metadata origin mismatch");
  }
  return data;
}

function escaped(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function rewriteOgHtml(response: Response, data: Metadata): Response {
  let canonicalFound = false;
  const attrs: Record<string, string> = {
    'meta[name="description"]': data.description,
    'meta[property="og:title"]': data.title,
    'meta[property="og:description"]': data.description,
    'meta[property="og:url"]': data.canonicalUrl,
    'meta[property="og:image"]': data.imageUrl,
    'meta[property="og:image:alt"]': data.imageAlt,
    'meta[name="twitter:card"]': "summary_large_image",
    'meta[name="twitter:title"]': data.title,
    'meta[name="twitter:description"]': data.description,
    'meta[name="twitter:image"]': data.imageUrl,
  };
  const found = new Set<string>();
  let rewrite = new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(data.title); } })
    .on('link[rel="canonical"]', { element(element) {
      if (canonicalFound) { element.remove(); return; }
      canonicalFound = true;
      element.setAttribute("href", data.canonicalUrl);
    } })
    .on("head", { element(element) { element.onEndTag(tag => {
      if (!canonicalFound) tag.before(`<link rel="canonical" href="${escaped(data.canonicalUrl)}">`, { html: true });
      for (const [selector, value] of Object.entries(attrs)) {
        if (found.has(selector)) continue;
        const attribute = selector.startsWith("meta[name=") ? "name" : "property";
        const key = selector.match(/="([^"]+)"/)?.[1];
        if (key) tag.before(`<meta ${attribute}="${escaped(key)}" content="${escaped(value)}">`, { html: true });
      }
    }); } });
  for (const [selector, value] of Object.entries(attrs)) {
    rewrite = rewrite.on(selector, { element(element) {
      if (found.has(selector)) { element.remove(); return; }
      found.add(selector);
      element.setAttribute("content", value);
    } });
  }
  return noStore(rewrite.transform(response));
}

export async function handleOgWorkerRequest(request: Request, env: OgWorkerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const route = ogRoute(url.pathname);
  if (route) {
    const allow = route.meta ? "GET" : "GET, HEAD";
    if (route.meta ? request.method !== "GET" : request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { ...NO_STORE, Allow: allow } });
    }
    if (!env.OG_RATE_LIMITER) return new Response("OG unavailable", { status: 503, headers: NO_STORE });
    const key = `${route.entity}:${route.meta ? "meta" : "image"}:${request.headers.get("CF-Connecting-IP") ?? "local"}`;
    const { success } = await env.OG_RATE_LIMITER.limit({ key });
    if (!success) return new Response("Too Many Requests", { status: 429,
      headers: { ...NO_STORE, "Retry-After": "60" } });
    try {
      if (route.meta) {
        const data = await metadata(env, route.entity, route.id);
        if (!data) return new Response("Not Found", { status: 404, headers: NO_STORE });
        const { canonicalUrl, imageUrl, updatedAt, revision } = data;
        return new Response(JSON.stringify({ canonicalUrl, imageUrl, updatedAt, revision }), {
          headers: { ...NO_STORE, "Content-Type": "application/json; charset=utf-8" },
        });
      }
      const upstream = await edge(env, route.entity, "image", route.id,
        request.method as "GET" | "HEAD", url.searchParams.get("v") ?? undefined);
      const headers = new Headers(NO_STORE);
      for (const name of ["Content-Type", "ETag", "Allow"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
    } catch (error) {
      console.error("[og-worker] upstream", { entity: route.entity, error: error instanceof Error ? error.message : "unknown" });
      return new Response("Internal server error", { status: 500, headers: NO_STORE });
    }
  }
  if (url.pathname.startsWith("/api/og/")) {
    return new Response("Not Found", { status: 404, headers: NO_STORE });
  }
  if (url.pathname === "/admin/og-preview") {
    return noStore(await env.ASSETS.fetch(request), "noindex, nofollow");
  }
  const page = request.method === "GET" && request.headers.get("Accept")?.includes("text/html")
    ? pageRoute(url.pathname) : null;
  if (!page) return null;
  const assetRequest = url.pathname.startsWith("/@")
    ? new Request(new URL(url.pathname.replace(/^\/@/, "/%40") + url.search, url.origin), request)
    : request;
  const asset = await env.ASSETS.fetch(assetRequest);
  if (!asset.ok || !asset.headers.get("Content-Type")?.includes("text/html")) return asset;
  try {
    const data = await metadata(env, page.entity, page.id);
    return data ? rewriteOgHtml(asset, data) : noStore(asset);
  } catch (error) {
    console.error("[og-worker] metadata", { entity: page.entity, error: error instanceof Error ? error.message : "unknown" });
    return noStore(asset);
  }
}
