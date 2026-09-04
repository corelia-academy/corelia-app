type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

export type WorkerEnv = {
  ASSETS: AssetsBinding;
};

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);

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
