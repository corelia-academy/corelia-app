import {
  findCaptionWindows,
  getYoutubeVideoId,
  languageFromCaptionFilename,
  parseWebVtt,
} from "./youtube-captions.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nexpected: ${JSON.stringify(expected)}\nactual:   ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("parses VTT cue times and removes speaker/formatting markup", () => {
  const cues = parseWebVtt(
    `WEBVTT\nLanguage: en\n\n1\n00:00:01.250 --> 00:00:03.500 align:start\n<v Alex><c.green>Queues</c> carry &amp; preserve work.\n\n00:00:04.000 --> 00:00:05.000\nA second cue.`,
  );
  assertEquals(cues, [
    { start_ms: 1250, end_ms: 3500, text: "Queues carry & preserve work." },
    { start_ms: 4000, end_ms: 5000, text: "A second cue." },
  ], "the parser should retain cue times and readable words");
});

Deno.test("returns a few short matching windows with stable provenance and no full transcript", async () => {
  const cues = Array.from({ length: 24 }, (_, index) => ({
    start_ms: index * 10_000,
    end_ms: index * 10_000 + 3_000,
    text: index === 8
      ? "A queue preserves messages until a worker is ready."
      : `Unrelated sentence number ${index}.`,
  }));
  const windows = await findCaptionWindows(
    cues,
    "queue worker preserves messages",
  );
  assert(
    windows.length > 0 && windows.length <= 3,
    "should return between one and three candidates",
  );
  const best = windows[0];
  assert(
    best.start_seconds <= 80 && best.end_seconds > 80,
    "the best match should cover the relevant cue",
  );
  assert(
    best.end_seconds - best.start_seconds <= 45,
    "candidate windows should stay short",
  );
  assert(best.cue_count > 0, "provenance should count the supporting cues");
  assert(
    /^[a-f0-9]{64}$/.test(best.cue_text_sha256),
    "provenance should contain a SHA-256 digest",
  );
  assert(best.excerpt.length <= 281, "the returned excerpt should be bounded");
  assert(
    !best.excerpt.includes("Unrelated sentence number 0"),
    "the helper must not return the full transcript",
  );
});

Deno.test("returns no candidate if captions do not overlap the lesson query", async () => {
  const windows = await findCaptionWindows([
    { start_ms: 0, end_ms: 2000, text: "This caption is about gardens." },
  ], "distributed queue workers");
  assertEquals(
    windows,
    [],
    "a lexical miss should lead A5 to use its full-video fallback",
  );
});

Deno.test("drops malformed and overlong cues that cannot define a short segment", () => {
  const cues = parseWebVtt(
    `WEBVTT\n\n00:00:00.000 --> 00:01:00.000\nOverlong cue.\n\n00:00:02.000 --> 00:00:02.000\nEmpty cue.\n\n00:00:03.000 --> 00:00:04.000\nUsable cue.`,
  );
  assertEquals(
    cues,
    [{ start_ms: 3000, end_ms: 4000, text: "Usable cue." }],
    "unusable cue bounds should be ignored",
  );
});

Deno.test("accepts only secure canonical YouTube candidate URLs", () => {
  assertEquals(
    getYoutubeVideoId("https://www.youtube.com/watch?v=abcdefghijk&t=30"),
    "abcdefghijk",
    "watch URL",
  );
  assertEquals(
    getYoutubeVideoId("https://youtu.be/abcdefghijk"),
    "abcdefghijk",
    "short URL",
  );
  assertEquals(
    getYoutubeVideoId("https://youtube.com.evil.example/watch?v=abcdefghijk"),
    null,
    "lookalike host",
  );
  assertEquals(
    getYoutubeVideoId("http://youtube.com/watch?v=abcdefghijk"),
    null,
    "insecure URL",
  );
  assertEquals(
    getYoutubeVideoId("https://user:pass@youtube.com/watch?v=abcdefghijk"),
    null,
    "embedded credentials",
  );
  assertEquals(
    getYoutubeVideoId("https://youtube.com/watch?v=short"),
    null,
    "invalid video ID",
  );
});

Deno.test("normalizes yt-dlp language filenames that include an NA prefix", () => {
  assertEquals(
    languageFromCaptionFilename("abcdefghijk.NA.en.vtt", "abcdefghijk"),
    "en",
    "English suffix",
  );
  assertEquals(
    languageFromCaptionFilename("abcdefghijk.en-US.vtt", "abcdefghijk"),
    "en-US",
    "English locale",
  );
});
