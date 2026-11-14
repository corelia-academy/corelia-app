import {
  buildCaptionOutline,
  captionWindowForRange,
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

Deno.test("explicit range: evidence covers the cues inside it and is reproducible", async () => {
  const cues = [
    { start_ms: 1000, end_ms: 3000, text: "Intro words." },
    { start_ms: 4000, end_ms: 6000, text: "The concept starts here." },
    { start_ms: 6000, end_ms: 9000, text: "And it ends here." },
    { start_ms: 12000, end_ms: 14000, text: "Outro words." },
  ];
  const first = await captionWindowForRange(cues, 4, 9);
  assert(first !== null, "a range with cues should produce a window");
  assertEquals(
    [first.start_seconds, first.end_seconds, first.cue_count],
    [4, 9, 2],
    "the window should span exactly the cues inside the range",
  );
  const again = await captionWindowForRange(cues, 4, 9);
  assertEquals(again?.cue_text_sha256, first.cue_text_sha256, "the same range must give the same hash");
  const other = await captionWindowForRange(cues, 1, 9);
  assert(other !== null && other.cue_text_sha256 !== first.cue_text_sha256, "a different range must give a different hash");
  assertEquals(await captionWindowForRange(cues, 20, 30), null, "a range without cues has no window");
  // A cue that crosses the range edge is not half-included.
  assertEquals((await captionWindowForRange(cues, 5, 9))?.cue_count, 1, "only cues fully inside the range count");
});

Deno.test("outline: groups cues into segments with start_seconds, end_seconds, text and covers requested range", () => {
  const cues = [
    { start_ms: 0, end_ms: 15000, text: "First introductory thought." },
    { start_ms: 16000, end_ms: 36000, text: "Second thought completing idea." },
    { start_ms: 37000, end_ms: 60000, text: "Third thought in next segment." },
  ];
  const outline = buildCaptionOutline(cues);
  assert(outline !== null, "outline should be produced");
  assertEquals(outline.truncated, false, "short video should not be truncated");
  assertEquals(outline.range.start_seconds, 0, "outline should start at 0");
  assertEquals(outline.range.end_seconds, 60, "outline should end at 60");
  assert(outline.segments.length >= 1, "should have at least one segment");
  assertEquals(outline.segments[0].start_seconds, 0, "segment should start at 0");
  assert(outline.segments[0].text.includes("First introductory thought."), "text should include first cue");

  // With explicit range
  const scoped = buildCaptionOutline(cues, { start: 16, end: 60 });
  assert(scoped !== null, "scoped outline should not be null");
  assertEquals(scoped.range.start_seconds, 16, "scoped start should match");
  assertEquals(scoped.range.end_seconds, 60, "scoped end should match");
  assertEquals(scoped.truncated, false, "scoped should not be truncated");
});

Deno.test("outline: reports truncated: true and returned range when cues exceed duration ceiling", () => {
  // Create 50 cues spanning 1500 seconds (exceeding MAX_OUTLINE_DURATION_SECONDS = 720)
  const cues = Array.from({ length: 50 }, (_, i) => ({
    start_ms: i * 30_000,
    end_ms: (i + 1) * 30_000,
    text: `Segment sentence number ${i}.`,
  }));

  const outline = buildCaptionOutline(cues);
  assert(outline !== null, "outline should not be null");
  assertEquals(outline.truncated, true, "video longer than 720s ceiling should be truncated");
  assert(outline.range.end_seconds >= 720, "range should span up to the ceiling");
  assert(outline.range.end_seconds < 1500, "range should not span whole 1500s video");
  assertEquals(outline.segments[0].start_seconds, 0, "outline should start at 0");

  // But with specific range under ceiling, truncated is false
  const ranged = buildCaptionOutline(cues, { start: 100, end: 300 });
  assert(ranged !== null, "ranged outline should not be null");
  assertEquals(ranged.truncated, false, "range <= ceiling should not be truncated");
  assertEquals(ranged.range.start_seconds, 120, "first cue >= 100s starts at 120s");
  assertEquals(ranged.range.end_seconds, 300, "last cue in range ends at 300s");
});

Deno.test("outline: returns null when requested range has no cues", () => {
  const cues = [
    { start_ms: 1000, end_ms: 5000, text: "Early cue." },
  ];
  const outline = buildCaptionOutline(cues, { start: 100, end: 200 });
  assertEquals(outline, null, "range with no cues returns null");
});
