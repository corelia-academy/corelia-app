import { handleOgWorkerRequest, type OgWorkerEnv } from "./og";

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

export type WorkerEnv = OgWorkerEnv & {
  ASSETS: AssetsBinding;
  CORELIA_API_URL?: string;
};

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
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
    console.warn("[missing-static-asset]", {
      event: "missing_static_asset",
      path: url.pathname,
    });

    return new Response(request.method === "HEAD" ? null : "Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleRequest,
};
