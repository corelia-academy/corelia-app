import { expect, it, vi } from "vitest";
import { handleVerifyCertificate } from "./verify.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

it("rejects an oversized streamed verification request before database access", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ code: "A".repeat(9_000) }));
  const request = new Request("https://example.test/functions/v1/corelia-api?op=certificates.verify", {
    method: "POST",
    body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
    // Deliberately omit Content-Length, as chunked requests do.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const rpc = vi.fn();

  const response = await handleVerifyCertificate(request, { rpc } as unknown as SupabaseClient);

  expect(response.status).toBe(413);
  expect(rpc).not.toHaveBeenCalled();
});
