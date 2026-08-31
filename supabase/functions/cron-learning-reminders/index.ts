/**
 * Scheduled entrypoint for the daily learning-reminder digest.
 *
 * Configure Supabase Scheduler (or an external cron) to invoke this function
 * once per day with `LEARNING_REMINDER_CRON_SECRET` set in both functions.
 */
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
};

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const expected = env("LEARNING_REMINDER_CRON_SECRET");
  const provided = req.headers.get("x-corelia-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ message: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabaseUrl = env("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ message: "missing_supabase_url" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/corelia-api?op=courses.sendLearningReminders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-corelia-cron-secret": expected,
    },
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { ...corsHeaders, "content-type": response.headers.get("content-type") ?? "application/json" },
  });
});
