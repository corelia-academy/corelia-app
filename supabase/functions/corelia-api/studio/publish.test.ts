import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appImagePath, diagramFile, draftDir, draftPath, publishMarkdown } from "./diagram_render.ts";
import { article, base, curriculum, editCode, question } from "./lesson_fixtures.ts";
import { lessonRefs, toLessonDraft } from "./lessons.ts";
import { buildPublishPayload, imageJobs, publishRun, PublishRejected, slugify } from "./publish.ts";

const brief = { topic: "Rust cơ bản", audience: "Người mới", level: "beginner", locale: "vi" };
const outputs: Record<string, object> = {
  "l-art": { ...base, article },
  "l-quiz": { ...base, quiz: { questions: [question(), question({ question: "Câu 2" })] } },
  "l-code": { ...base, code: editCode, source_ids: ["s1", "s2"] },
  "l-prac": { ...base, practice: { description_markdown: "Làm.", mode: "instruction", checklist_items: [] } },
  "l-vid": { ...base, source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 0, end_seconds: 0 } },
};
const prov = { model_id: "m", prompt_version: "p" };
const records = Object.fromEntries(lessonRefs(curriculum).map((r) => [r.lesson.id, { draft: toLessonDraft(r, outputs[r.lesson.id] as never, "vi"), written: prov, reviewed: prov }]));
const input = { runId: "run-1", courseId: "11111111-1111-4111-8111-111111111111", title: "Khóa Rust cơ bản", brief, curriculum, records };

describe("studio publish: payload", () => {
  it("makes the app's rows: sections per module, lessons in order with section ids, questions by lesson", () => {
    const p = buildPublishPayload(input);
    expect(p.sections.map((s) => [s.id, s.sort_order])).toEqual([["m1", 0], ["m2", 1]]);
    expect(p.lessons.map((l) => [l.id, l.section_id, l.sort_order])).toEqual([
      ["l-art", "m1", 0],
      ["l-quiz", "m1", 1],
      ["l-code", "m2", 2],
      ["l-prac", "m2", 3],
      ["l-vid", "m2", 4],
    ]);
    expect(p.questions.map((q) => [q.lesson_id, q.sort_order])).toEqual([["l-quiz", 0], ["l-quiz", 1]]);
    expect(p.questions[0].data).toMatchObject({ type: "mcq", correct_index: 1, locale: "vi" });
  });

  it("keeps id, section, order and published out of the lesson data, which is a CourseLesson", () => {
    const quiz = buildPublishPayload(input).lessons[1].data;
    expect(quiz).toMatchObject({ lesson_format: "quiz", title: "Tiêu đề", duration_seconds: 300, quiz_config: { passing_ratio: 0.7, allow_retry: true } });
    for (const key of ["id", "section_id", "order", "published"]) expect(quiz).not.toHaveProperty(key);
  });

  it("marks the course as AI generated, owned by Corelia, in the run's locale", () => {
    const { course } = buildPublishPayload(input);
    expect(course.slug).toBe("khoa-rust-co-ban");
    expect(course.data).toMatchObject({
      title: "Khóa Rust cơ bản",
      level: "beginner",
      course_type: "ai_generated",
      owner_type: "corelia",
      i18n: { supported_locales: ["vi"], primary_content_locale: "vi" },
      learning_outcomes: ["Làm được X", "Làm được Y"],
    });
  });

  it("points diagram references at the app's lesson images", () => {
    const md = buildPublishPayload(input).lessons[0].data.description_markdown as string;
    expect(md).toContain(`![sơ đồ](/lesson-image/${input.courseId}/l-art-d1.png)`);
    expect(md).not.toContain("diagram:");
  });

  it("refuses a locale the app cannot show and a missing lesson", () => {
    expect(() => buildPublishPayload({ ...input, brief: { ...brief, locale: "fr" } })).toThrow(PublishRejected);
    const { "l-vid": _gone, ...rest } = records;
    expect(() => buildPublishPayload({ ...input, records: rest })).toThrow("Thiếu lesson l-vid");
  });
});

describe("studio publish: images and names", () => {
  it("copies each diagram from the draft bucket to the app's lesson folder", () => {
    expect(imageJobs(input)).toEqual([{ from: "run-1/l-art/d1.png", to: `course-thumbnails/${input.courseId}/lessons/l-art-d1.png` }]);
  });

  it("builds file names the app accepts for /lesson-image references", () => {
    const ref = /^[A-Za-z0-9_-]{1,64}\.[a-z0-9]{1,8}$/;
    for (const [lesson, diagram] of [["l-art", "d1"], ["Bài 1: Cargo", "Sơ đồ #2"], ["x".repeat(80), "y".repeat(80)], ["", ""]]) {
      expect(diagramFile(lesson, diagram)).toMatch(ref);
    }
    expect(draftPath("r", "L 1", "D/2")).toBe("r/l-1/d-2.png");
    expect(draftDir("r", "L 1")).toBe("r/l-1");
    expect(appImagePath("c", "f.png")).toBe("course-thumbnails/c/lessons/f.png");
  });

  it("rewrites only diagram references", () => {
    expect(publishMarkdown("![a](diagram:d1) và ![b](https://x.dev/i.png)", "c1", "l1")).toBe("![a](/lesson-image/c1/l1-d1.png) và ![b](https://x.dev/i.png)");
  });

  it("slugifies Vietnamese titles", () => {
    expect(slugify("Rust cơ bản cho lập trình viên Web3")).toBe("rust-co-ban-cho-lap-trinh-vien-web3");
    expect(slugify("Đường đi")).toBe("duong-di");
    expect(slugify("???")).toBe("course");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe("publishRun: cover generation and invariants", () => {
  const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>`;

  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("api.iconify.design")) {
        if (urlStr.includes("/search")) {
          return new Response(JSON.stringify({ icons: ["simple-icons:stellar"], total: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.endsWith(".svg")) {
          return new Response(mockSvg, {
            status: 200,
            headers: { "Content-Type": "image/svg+xml" },
          });
        }
      }
      return new Response("Not found", { status: 404 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeMockDb(options: {
    existingCourse?: { data: Record<string, unknown> } | null;
    paths?: Array<{ learning_order: number; studio_paths: { title: string } }>;
    coverUploadFails?: boolean;
    rpcFails?: boolean;
    secondReadCourse?: { data: Record<string, unknown> } | null;
  } = {}) {
    const uploadedFiles: Record<string, Uint8Array | Blob> = {};
    const removedFiles: string[] = [];
    const insertedEvents: Array<Record<string, unknown>> = [];
    let courseRpcPayload: Record<string, unknown> | null = null;
    let courseUpdates: Record<string, unknown> | null = null;
    let readCount = 0;

    const db = {
      storage: {
        from(bucket: string) {
          return {
            async download(path: string) {
              return { data: new Uint8Array([1, 2, 3]), error: null };
            },
            async upload(path: string, data: Uint8Array | Blob) {
              if (options.coverUploadFails && path.includes("cover.png")) {
                return { error: new Error("Storage upload failed") };
              }
              uploadedFiles[`${bucket}/${path}`] = data;
              return { error: null };
            },
            async remove(paths: string[]) {
              removedFiles.push(...paths);
              for (const p of paths) delete uploadedFiles[`${bucket}/${p}`];
              return { error: null };
            },
            getPublicUrl(path: string) {
              return { data: { publicUrl: `https://storage.test/${bucket}/${path}` } };
            },
          };
        },
      },
      from(table: string) {
        return {
          select(_cols?: string) {
            return {
              eq(_col: string, _val: unknown) {
                return {
                  async maybeSingle() {
                    readCount++;
                    if (readCount > 1 && options.secondReadCourse !== undefined) {
                      return { data: options.secondReadCourse, error: null };
                    }
                    return { data: options.existingCourse ?? null, error: null };
                  },
                  order(_orderCol: string, _opts?: unknown) {
                    return Promise.resolve({ data: options.paths ?? [], error: null });
                  },
                };
              },
            };
          },
          async insert(row: Record<string, unknown>) {
            insertedEvents.push(row);
            return { error: null };
          },
          update(patch: Record<string, unknown>) {
            courseUpdates = patch;
            return {
              eq(_col: string, _val: unknown) {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
      async rpc(name: string, args: Record<string, unknown>) {
        if (name === "studio_publish_course") {
          courseRpcPayload = args.p_course as Record<string, unknown>;
          if (options.rpcFails) {
            return { data: null, error: { code: "P0001", message: "RPC rejected" } };
          }
          return { data: "test-course-id", error: null };
        }
        return { data: null, error: null };
      },
    } as any;

    return {
      db,
      uploadedFiles,
      removedFiles,
      insertedEvents,
      getRpcCourse: () => courseRpcPayload,
      getUpdates: () => courseUpdates,
    };
  }

  it("generates cover and sets thumbnail_url via RPC payload on publish without courses.update", async () => {
    const { db, uploadedFiles, getRpcCourse, getUpdates } = makeMockDb({
      paths: [{ learning_order: 1, studio_paths: { title: "Stellar" } }],
    });

    const result = await publishRun(db, input);
    expect(result).toBe("test-course-id");
    const rpcCourse = getRpcCourse();
    expect(rpcCourse?.data).toHaveProperty("thumbnail_url");
    const thumbUrl = (rpcCourse?.data as any).thumbnail_url;
    expect(thumbUrl).toBe(`https://storage.test/cdn/course-thumbnails/${input.courseId}/cover.png`);
    expect(uploadedFiles).toHaveProperty(`cdn/course-thumbnails/${input.courseId}/cover.png`);
    // Acceptance: Không có lệnh courses.update nào ghi cả object data
    expect(getUpdates()).toBeNull();
  });

  it("retains empty thumbnail and logs warning event if cover generation fails without blocking publish", async () => {
    const { db, insertedEvents, getRpcCourse, getUpdates } = makeMockDb({
      coverUploadFails: true,
    });

    const result = await publishRun(db, input);
    expect(result).toBe("test-course-id");
    const rpcCourse = getRpcCourse();
    expect((rpcCourse?.data as any).thumbnail_url).toBe("");
    expect(insertedEvents.some((e) => e.step_key === "publish" && e.kind === "warning")).toBe(true);
    expect(getUpdates()).toBeNull();
  });

  it("handles cover generation timeout (>10s): aborts work, publishes with empty thumbnail, and creates no side effects", async () => {
    vi.useFakeTimers();
    try {
      // Mock fetch that hangs until aborted
      vi.spyOn(globalThis, "fetch").mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });
      });

      const { db, uploadedFiles, insertedEvents, getRpcCourse, getUpdates } = makeMockDb({
        paths: [{ learning_order: 1, studio_paths: { title: "Stellar" } }],
      });

      const publishPromise = publishRun(db, input);

      // Advance fake timers past the 10s ceiling
      await vi.advanceTimersByTimeAsync(10_000);

      const result = await publishPromise;
      expect(result).toBe("test-course-id");

      // RPC payload must have empty thumbnail_url
      const rpcCourse = getRpcCourse();
      expect((rpcCourse?.data as any).thumbnail_url).toBe("");

      // Must have logged a warning event for cover timeout
      expect(
        insertedEvents.some(
          (e) => e.step_key === "publish" && e.kind === "warning" && String(e.message).includes("timed out after 10s")
        )
      ).toBe(true);

      // No orphaned cover file in storage
      expect(Object.keys(uploadedFiles).some((k) => k.includes("cover.png"))).toBe(false);

      // No courses.update executed
      expect(getUpdates()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleans up uploaded images including cover if database RPC rejects", async () => {
    const { db, removedFiles } = makeMockDb({
      paths: [{ learning_order: 1, studio_paths: { title: "Stellar" } }],
      rpcFails: true,
    });

    await expect(publishRun(db, input)).rejects.toThrow("RPC rejected");
    expect(removedFiles).toContain(`course-thumbnails/${input.courseId}/cover.png`);
  });
});
