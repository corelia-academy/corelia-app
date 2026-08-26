import { corsHeadersForRequest, json, withCors } from "./lib/http.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    const cors = corsHeadersForRequest(req);
    return new Response(null, {
      status: 204,
      headers: cors ?? undefined,
    });
  }

  return withCors(
    req,
    json(
      {
        ok: false,
        error: "AI capability retired",
        code: "AI_FEATURE_RETIRED",
        message: "Tính năng AI dành cho người học đã ngừng hoạt động theo kế hoạch Epic #332.",
      },
      410,
    ),
  );
});
