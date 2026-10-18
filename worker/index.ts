import { handleOgWorkerRequest, type OgWorkerEnv } from "./og";

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

export type WorkerEnv = OgWorkerEnv & {
  ASSETS: AssetsBinding;
  CORELIA_API_URL?: string;
  /** Path prefix the SPA is served under, e.g. "/learn". Assets are stored without it. */
  CORELIA_APP_BASE_PATH?: string;
};

const NOT_FOUND_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function basePathOf(env: WorkerEnv): string {
  return (env.CORELIA_APP_BASE_PATH ?? "").replace(/\/+$/, "");
}

/**
 * The SPA is not indexable: public, SEO-facing pages are rendered by the landing site.
 * index.html also carries a robots meta tag for navigations served straight from assets.
 */
function withNoIndex(response: Response): Response {
  if (!response.headers.get("Content-Type")?.includes("text/html") || response.headers.has("X-Robots-Tag")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const basePath = basePathOf(env);
  if (basePath) {
    const incoming = new URL(request.url);
    const inBase = incoming.pathname === basePath || incoming.pathname.startsWith(`${basePath}/`);
    if (!inBase) {
      return new Response(request.method === "HEAD" ? null : "Not Found", { status: 404, headers: NOT_FOUND_HEADERS });
    }
    const stripped = new URL(incoming);
    stripped.pathname = incoming.pathname.slice(basePath.length) || "/";
    request = new Request(stripped, request);
  }
  return withNoIndex(await routeRequest(request, env, Boolean(basePath)));
}

/**
 * `prefixed`: the request arrived under the base path, so the asset layer could not match it
 * by itself and every hashed asset — present or not — reaches the Worker.
 */
async function routeRequest(request: Request, env: WorkerEnv, prefixed: boolean): Promise<Response> {
  const url = new URL(request.url);
  const ogResponse = await handleOgWorkerRequest(request, env);
  if (ogResponse) return ogResponse;

  const avatarMatch = /^\/avatar\/([a-zA-Z0-9_]{1,32})\.svg$/.exec(url.pathname);
  if (url.pathname.startsWith("/avatar/") || url.pathname === "/api/me/avatar") {
    const isSave = url.pathname === "/api/me/avatar";
    if ((isSave && request.method !== "PATCH") || (!isSave && request.method !== "GET")) {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: isSave ? "PATCH" : "GET", "Cache-Control": "no-store" } });
    }
    if (!isSave && !avatarMatch) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!env.CORELIA_API_URL) return new Response("Avatar unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    const cacheKey = !isSave ? new Request(`${url.origin}${url.pathname}`) : null;
    if (cache && cacheKey) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }
    const target = new URL(env.CORELIA_API_URL);
    target.searchParams.set("op", isSave ? "avatar.save" : "avatar.svg");
    if (avatarMatch) target.searchParams.set("username", avatarMatch[1]);
    const headers = new Headers();
    if (isSave) {
      const auth = request.headers.get("Authorization");
      if (auth) headers.set("Authorization", auth);
      headers.set("Content-Type", "application/json");
    }
    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: isSave ? request.body : undefined,
      });
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete("set-cookie");
      if (!upstream.ok) responseHeaders.set("Cache-Control", "no-store");
      const response = new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
      if (cache && cacheKey && response.ok && responseHeaders.get("Content-Type")?.startsWith("image/svg+xml")) {
        try { await cache.put(cacheKey, response.clone()); } catch { /* SVG remains available without edge cache. */ }
      }
      return response;
    } catch {
      return new Response("Avatar unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (url.pathname.startsWith("/assets/")) {
    if (prefixed) {
      // The SPA fallback answers unknown paths with index.html, so only a non-HTML hit is the real file.
      const asset = await env.ASSETS.fetch(request);
      if (asset.ok && !asset.headers.get("Content-Type")?.includes("text/html")) return asset;
    }
    console.warn("[missing-static-asset]", {
      event: "missing_static_asset",
      path: url.pathname,
    });

    return new Response(request.method === "HEAD" ? null : "Not Found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleRequest,
};
