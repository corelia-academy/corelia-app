/** Scheduler entrypoint for Email Center. Invoke every minute. */
function env(name: string): string { return Deno.env.get(name)?.trim() ?? ""; }

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(JSON.stringify({ message: "method_not_allowed" }), { status: 405, headers: { "content-type": "application/json" } });
  const expected = env("EMAIL_WORKER_SECRET");
  const supplied = req.headers.get("x-corelia-email-worker-secret")?.trim() ?? "";
  if (!expected || supplied !== expected) return new Response(JSON.stringify({ message: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  const url = env("SUPABASE_URL");
  if (!url) return new Response(JSON.stringify({ message: "missing_supabase_url" }), { status: 500, headers: { "content-type": "application/json" } });
  const response = await fetch(`${url}/functions/v1/corelia-api?op=email.worker`, { method: "POST", headers: { "content-type": "application/json", "x-corelia-email-worker-secret": expected } });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
});
