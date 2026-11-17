import { keywordQuery, parseSearchLine, prioritizeByDuration, selectApprovedChannels } from "./youtube-search.ts";

function assertEquals<T>(actual: T, expected: T, message: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

const channel = { name: "Ethereum Foundation", handle: "@ethereumfoundation" };

Deno.test("parseSearchLine keeps a video of the searched channel under the approved channel name", () => {
  const line = JSON.stringify({ id: "CxmUuYvj2mM", title: " Wallets and data ", duration: 984.4, channel: "someone else" });
  assertEquals(parseSearchLine(line, channel), {
    video_id: "CxmUuYvj2mM",
    url: "https://www.youtube.com/watch?v=CxmUuYvj2mM",
    title: "Wallets and data",
    channel: "Ethereum Foundation",
    handle: "@ethereumfoundation",
    duration_seconds: 984,
  }, "candidate");
});

Deno.test("parseSearchLine drops lines that are not a usable video", () => {
  assertEquals(parseSearchLine("not json", channel), null, "invalid json");
  assertEquals(parseSearchLine(JSON.stringify({ id: "short", title: "x" }), channel), null, "bad id");
  assertEquals(parseSearchLine(JSON.stringify({ id: "CxmUuYvj2mM", title: "  " }), channel), null, "empty title");
});

Deno.test("keywordQuery keeps the leading meaningful words of a long topic", () => {
  assertEquals(keywordQuery("Wallets receiving address private key recovery phrase safety for beginners"), "wallets receiving address", "long query");
  assertEquals(keywordQuery("What is the gas fee"), "gas fee", "filler removed");
});

Deno.test("selectApprovedChannels narrows channels by track and optional handles", () => {
  const backendHandles = selectApprovedChannels(null, "backend").map((c) => c.handle);
  if (!backendHandles.includes("@hnasr") || backendHandles.includes("@solana")) {
    throw new Error(`unexpected backend channels: ${backendHandles.join(",")}`);
  }
  const narrowed = selectApprovedChannels(["@hnasr", "@solana"], "backend").map((c) => c.handle);
  assertEquals(narrowed, ["@hnasr"], "track + handle intersection");
});

Deno.test("prioritizeByDuration ranks 2-30m videos before long videos, unknown durations, and shorts", () => {
  const sample = (id: string, duration_seconds: number | null) => ({
    video_id: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: id,
    channel: "ByteByteGo",
    handle: "@bytebytego",
    duration_seconds,
  });
  const ordered = prioritizeByDuration([
    sample("short", 45),
    sample("long", 3600),
    sample("unknown", null),
    sample("ideal1", 600),
    sample("ideal2", 1500),
  ]).map((c) => c.video_id);
  assertEquals(ordered, ["ideal1", "ideal2", "long", "unknown", "short"], "duration bucket order");
});
