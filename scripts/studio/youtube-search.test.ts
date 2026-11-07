import { keywordQuery, parseSearchLine } from "./youtube-search.ts";

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
