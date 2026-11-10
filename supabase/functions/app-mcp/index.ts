import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource } from "npm:@supabase/server@1";
import { createServiceClient, verifyBearerUser } from "../corelia-api/lib/supabase.ts";

const handler = pipeline([withOAuthProtectedResource()], async (req) => {
  const db = createServiceClient();
  let userId: string;
  try {
    userId = (await verifyBearerUser(req, db)).id;
  } catch {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const profile = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile.error) return Response.json({ error: "database_unavailable" }, { status: 503 });
  const role = profile.data?.role;
  if (role !== "admin" && role !== "instructor") return Response.json({ error: "forbidden" }, { status: 403 });
  const server = new McpServer({ name: "corelia-app", version: "0.1.0" });
  server.registerTool("app_ping", {
    title: "Check Corelia App connection",
    description: "Check authentication, current role, and database connectivity. This does not verify permissions for a particular course.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    const check = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
    const ok = !check.error && Boolean(check.data);
    const value = { status: ok ? "pong" : "error", auth: "authenticated", role, database: ok ? "connected" : "unavailable", timestamp: new Date().toISOString() };
    return { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError: !ok };
  });
  return createMcpHandler(() => server).fetch(req);
});
Deno.serve(handler);
