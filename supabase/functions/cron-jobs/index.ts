/** Scheduled entrypoint for Corelia Jobs ingestion. */
function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

function response(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return response({ message: "method_not_allowed" }, 405);
  const expected = env("CORELIA_JOBS_CRON_SECRET");
  const provided = req.headers.get("x-corelia-jobs-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) return response({ message: "unauthorized" }, 401);
  const supabaseUrl = env("SUPABASE_URL");
  if (!supabaseUrl) return response({ message: "missing_supabase_url" }, 500);
  const upstream = await fetch(`${supabaseUrl}/functions/v1/corelia-api?op=jobs.runScheduled`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-corelia-jobs-cron-secret": expected,
    },
    body: await req.text() || "{}",
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
});
