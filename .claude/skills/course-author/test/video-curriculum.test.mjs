import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import {
  lintCurriculumData,
  MAX_VIDEOS_PER_MODULE,
  MAX_VIDEO_SEGMENT_SECONDS,
  MAX_FULL_VIDEO_SECONDS,
} from "../scripts/curriculum-lint.mjs";

const rootDir = path.resolve(".");
const scriptsDir = path.join(rootDir, ".claude/skills/course-author/scripts");

function run(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

// -------------------------------------------------------------
// AC4: Lint từ chối từng trường hợp vi phạm
// -------------------------------------------------------------

test("AC4.1: Lint từ chối bài video trỏ ứng viên supplement / reject / thiếu fit", () => {
  const baseCurriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V_SUPP", start_seconds: 0, end_seconds: 60 },
        ],
      },
    ],
    unused_primary_videos: [],
    no_video_reason: null,
  };

  // supplement
  let research = {
    videos: [
      { video_id: "V_SUPP", fit: "supplement", segments: [{ start_seconds: 0, end_seconds: 60, caption_evidence: { cue_text_sha256: "abc" } }] },
    ],
  };
  let problems = lintCurriculumData(baseCurriculum, research);
  assert.ok(problems.some((p) => p.includes("video-fit") && p.includes("supplement")));

  // reject
  research.videos[0].fit = "reject";
  problems = lintCurriculumData(baseCurriculum, research);
  assert.ok(problems.some((p) => p.includes("video-fit") && p.includes("reject")));

  // thiếu fit
  delete research.videos[0].fit;
  problems = lintCurriculumData(baseCurriculum, research);
  assert.ok(problems.some((p) => p.includes("video-fit") && p.includes("thiếu_fit")));
});

test("AC4.2: Lint từ chối hai bài video trong một module", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V1", start_seconds: 0, end_seconds: 60 },
          { lesson_id: "L1-2", type: "video", video_id: "V2", start_seconds: 0, end_seconds: 60 },
        ],
      },
    ],
    unused_primary_videos: [],
  };
  const research = {
    videos: [
      { video_id: "V1", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 60, caption_evidence: { cue_text_sha256: "abc" } }] },
      { video_id: "V2", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 60, caption_evidence: { cue_text_sha256: "def" } }] },
    ],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("ngân-sách-video") && p.includes("M1")));
});

test("AC4.3: Lint từ chối đoạn phát 721 giây", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V1", start_seconds: 0, end_seconds: 721 },
        ],
      },
    ],
    unused_primary_videos: [],
  };
  const research = {
    videos: [
      { video_id: "V1", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 721, caption_evidence: { cue_text_sha256: "abc" } }] },
    ],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("thời-lượng-đoạn") && p.includes("721s")));
});

test("AC4.4: Lint từ chối cả video 901 giây", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V1", start_seconds: 0, end_seconds: 0 },
        ],
      },
    ],
    unused_primary_videos: [],
  };
  const research = {
    videos: [
      { video_id: "V1", fit: "primary", duration_seconds: 901, segments: [] },
    ],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("thời-lượng-video") && p.includes("901s")));
});

test("AC4.5: Lint từ chối đoạn không khớp segments hoặc thiếu caption_evidence", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V1", start_seconds: 10, end_seconds: 70 },
        ],
      },
    ],
    unused_primary_videos: [],
  };
  // Segment không khớp timestamp
  let research = {
    videos: [
      { video_id: "V1", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 60, caption_evidence: { cue_text_sha256: "abc" } }] },
    ],
  };
  let problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("bằng-chứng-đoạn")));

  // Trùng timestamp nhưng thiếu caption_evidence
  research = {
    videos: [
      { video_id: "V1", fit: "primary", segments: [{ start_seconds: 10, end_seconds: 70, caption_evidence: null }] },
    ],
  };
  problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("bằng-chứng-đoạn")));
});

test("AC4.6: Lint từ chối ứng viên primary không dùng mà thiếu lý do", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V1", start_seconds: 0, end_seconds: 60 },
        ],
      },
    ],
    unused_primary_videos: [], // thiếu V2
  };
  const research = {
    videos: [
      { video_id: "V1", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 60, caption_evidence: { cue_text_sha256: "abc" } }] },
      { video_id: "V2", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 60, caption_evidence: { cue_text_sha256: "def" } }] },
    ],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("giải-trình-ứng-viên") && p.includes("V2")));
});

test("AC4.7: Lint từ chối khóa 0 video thiếu lý do", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "article" },
        ],
      },
    ],
    no_video_reason: "", // thiếu lý do
  };
  const research = {
    videos: [],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.ok(problems.some((p) => p.includes("giải-trình-khóa")));
});

// -------------------------------------------------------------
// AC5: Lint chấp nhận trường hợp hợp lệ
// -------------------------------------------------------------

test("AC5.1: Lint chấp nhận khóa không có ứng viên primary và không có bài video (kèm no_video_reason)", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "article" },
        ],
      },
    ],
    no_video_reason: "Research không tìm thấy ứng viên video phù hợp tiêu chí primary",
    unused_primary_videos: [],
  };
  const research = {
    videos: [
      { video_id: "V_SUPP", fit: "supplement" },
    ],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.equal(problems.length, 0);
});

test("AC5.2: Lint chấp nhận khóa có đúng 1 bài video mỗi module từ ứng viên primary với đoạn <= 720 giây", () => {
  const curriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V1", start_seconds: 0, end_seconds: 300 },
          { lesson_id: "L1-2", type: "article" },
        ],
      },
      {
        module_id: "M2",
        lessons: [
          { lesson_id: "L2-1", type: "video", video_id: "V2", start_seconds: 60, end_seconds: 600 },
          { lesson_id: "L2-2", type: "quiz" },
        ],
      },
    ],
    unused_primary_videos: [
      { video_id: "V3", reason: "Nội dung V3 trùng lặp với V1 và không cần thiết thêm vào module" },
    ],
  };
  const research = {
    videos: [
      { video_id: "V1", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 300, caption_evidence: { cue_text_sha256: "h1" } }] },
      { video_id: "V2", fit: "primary", segments: [{ start_seconds: 60, end_seconds: 600, caption_evidence: { cue_text_sha256: "h2" } }] },
      { video_id: "V3", fit: "primary", segments: [{ start_seconds: 0, end_seconds: 100, caption_evidence: { cue_text_sha256: "h3" } }] },
    ],
  };
  const problems = lintCurriculumData(curriculum, research);
  assert.equal(problems.length, 0);
});

// -------------------------------------------------------------
// AC6: Kiểm độ dài bài video
// -------------------------------------------------------------

test("AC6: Kiểm độ dài bài video tính cả thời lượng đoạn phát (đoạn 600s + 1000 từ)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-lint-video-length-"));
  const lessonsDir = path.join(tmpDir, "lessons");
  fs.mkdirSync(lessonsDir, { recursive: true });

  const word1000 = Array(1000).fill("từ").join(" ");

  const lessonContent = {
    lesson_id: "L1-1",
    type: "video",
    video: {
      youtube_url: "https://www.youtube.com/watch?v=aircAruvnKk",
      video_id: "aircAruvnKk",
      start_seconds: 0,
      end_seconds: 600,
      description_markdown: word1000,
    },
  };
  fs.writeFileSync(path.join(lessonsDir, "L1-1.json"), JSON.stringify(lessonContent, null, 2), "utf8");

  // target_minutes = 10 -> tổng thời gian 10m video + 5m đọc = 15m > 10 * 1.3 = 13m -> LỖI
  let curr = {
    modules: [{
      module_id: "M1",
      lessons: [{ lesson_id: "L1-1", type: "video", target_minutes: 10 }],
    }],
  };
  fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curr, null, 2), "utf8");
  let res = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /L1-1: độ-dài:/);

  // target_minutes = 15 -> tổng thời gian 15m <= 15 * 1.3 = 19.5m -> ĐẠT
  curr.modules[0].lessons[0].target_minutes = 15;
  fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curr, null, 2), "utf8");
  res = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(res.status, 0);
  assert.doesNotMatch(res.stdout, /L1-1: độ-dài:/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -------------------------------------------------------------
// AC7: lesson-context.mjs cho bài video xuất đủ field mới của ứng viên được chọn
// -------------------------------------------------------------
test("AC7: lesson-context.mjs cho bài video xuất đủ field mới của ứng viên được chọn", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-video-fixture-"));
  const curr = {
    modules: [{
      module_id: "M1",
      lessons: [{ lesson_id: "L1-1", type: "video", video_id: "V123", source_ids: ["S1"] }],
    }],
  };
  fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curr, null, 2), "utf8");

  const research = {
    topics: [{ topic_id: "T01", title: "Topic 1", key_points: [{ text: "KP1", source_ids: ["S1"] }] }],
    sources: [{ source_id: "S1", url: "https://example.com" }],
    videos: [{
      video_id: "V123",
      topic_id: "T01",
      url: "https://youtube.com/watch?v=123",
      title: "Video 123",
      rank: 1,
      duration_seconds: 400,
      fit: "primary",
      fit_reason: "Phù hợp",
      covers: ["KP1"],
      unsourced_points: ["Ý mới"],
      assumes: ["Khái niệm A"],
      segments: [{
        start_seconds: 10,
        end_seconds: 200,
        description: "Đoạn demo",
        caption_evidence: { cue_text_sha256: "abc" },
      }],
    }],
  };
  fs.writeFileSync(path.join(tmpDir, "research.json"), JSON.stringify(research, null, 2), "utf8");

  const res = run(`node ${path.join(scriptsDir, "lesson-context.mjs")} ${tmpDir} L1-1`);
  assert.equal(res.status, 0);

  const ctx = JSON.parse(res.stdout);
  assert.ok(ctx.research?.videos?.length === 1);
  const v = ctx.research.videos[0];
  assert.equal(v.video_id, "V123");
  assert.equal(v.duration_seconds, 400);
  assert.equal(v.fit, "primary");
  assert.deepEqual(v.covers, ["KP1"]);
  assert.deepEqual(v.unsourced_points, ["Ý mới"]);
  assert.deepEqual(v.assumes, ["Khái niệm A"]);
  assert.equal(v.segments?.length, 1);
  assert.equal(v.segments[0].caption_evidence?.cue_text_sha256, "abc");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -------------------------------------------------------------
// AC8: Role files không mâu thuẫn
// -------------------------------------------------------------
test("AC8: Role files không mâu thuẫn: 03-curriculum không đòi bổ trợ sau article, 05-video không có 80-200 từ, 04 và 06 có tiêu chí mới", () => {
  const rolesDir = path.join(rootDir, ".claude/skills/course-author/roles");
  const currText = fs.readFileSync(path.join(rolesDir, "03-curriculum.md"), "utf8");
  assert.doesNotMatch(currText, /đứng sau bài dạy nó bổ trợ/i, "03-curriculum không còn câu yêu cầu video đứng sau bài dạy nó bổ trợ");

  const videoLessonText = fs.readFileSync(path.join(rolesDir, "05-lesson/video.md"), "utf8");
  assert.doesNotMatch(videoLessonText, /80[–-]200\s*từ/, "05-lesson/video.md không còn mức cố định 80-200 từ");

  const currReviewText = fs.readFileSync(path.join(rolesDir, "04-curriculum-review.md"), "utf8");
  assert.match(currReviewText, /fit:\s*"primary"/);
  assert.match(currReviewText, /unused_primary_videos/);
  assert.match(currReviewText, /no_video_reason/);

  const videoReviewText = fs.readFileSync(path.join(rolesDir, "06-lesson-review/video.md"), "utf8");
  assert.match(videoReviewText, /chỉ đọc/i);
  assert.match(videoReviewText, /Tóm lược kiến thức/);
});

// -------------------------------------------------------------
// AC9: research.json thiếu field mới không làm script nào crash
// -------------------------------------------------------------
test("AC9: research.json thiếu field mới không làm script nào crash", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "old-research-fixture-"));
  const curr = {
    modules: [{
      module_id: "M1",
      lessons: [{ lesson_id: "L1-1", type: "video", video_id: "OLD_VID", start_seconds: 0, end_seconds: 30 }],
    }],
  };
  fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curr, null, 2), "utf8");

  const oldResearch = {
    topics: [{ topic_id: "T01", title: "T1", key_points: [{ text: "KP", source_ids: ["S1"] }] }],
    sources: [{ source_id: "S1", url: "https://example.com" }],
    videos: [{
      video_id: "OLD_VID",
      topic_id: "T01",
      url: "https://youtube.com/watch?v=123",
      title: "Old title",
      rank: 1,
    }],
  };
  fs.writeFileSync(path.join(tmpDir, "research.json"), JSON.stringify(oldResearch, null, 2), "utf8");

  const problems = lintCurriculumData(curr, oldResearch);
  assert.ok(problems.some((p) => p.includes("video-fit") && p.includes("thiếu_fit")), "báo lỗi lint rõ ràng thay vì crash");

  const ctxRes = run(`node ${path.join(scriptsDir, "lesson-context.mjs")} ${tmpDir} L1-1`);
  assert.equal(ctxRes.status, 0);
  const parsedCtx = JSON.parse(ctxRes.stdout);
  assert.equal(parsedCtx.research.videos[0].video_id, "OLD_VID");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -------------------------------------------------------------
// V-01: Lint không chặn một video làm hai bài
// -------------------------------------------------------------
test("V-01: Lint chặn một video làm bài primary hai lần và nêu video_id kèm hai lesson_id; hai video khác nhau đạt", () => {
  const dupCurriculum = {
    modules: [
      {
        module_id: "M1",
        lessons: [
          { lesson_id: "L1-1", type: "video", video_id: "V_DUP", start_seconds: 10, end_seconds: 100 },
        ],
      },
      {
        module_id: "M2",
        lessons: [
          { lesson_id: "L2-1", type: "video", video_id: "V_DUP", start_seconds: 10, end_seconds: 100 },
        ],
      },
    ],
    unused_primary_videos: [],
  };
  const research = {
    videos: [
      {
        video_id: "V_DUP",
        fit: "primary",
        segments: [{ start_seconds: 10, end_seconds: 100, caption_evidence: { cue_text_sha256: "abc" } }],
      },
      {
        video_id: "V_DIFF",
        fit: "primary",
        segments: [{ start_seconds: 10, end_seconds: 100, caption_evidence: { cue_text_sha256: "def" } }],
      },
    ],
  };

  const dupProblems = lintCurriculumData(dupCurriculum, research);
  assert.ok(
    dupProblems.some((p) => p.includes("video-trùng") && p.includes("V_DUP") && p.includes("L1-1") && p.includes("L2-1")),
    `Phải báo lỗi video-trùng nêu video_id và hai lesson_id: ${JSON.stringify(dupProblems)}`
  );

  const okCurriculum = {
    ...dupCurriculum,
    modules: [
      dupCurriculum.modules[0],
      {
        module_id: "M2",
        lessons: [
          { lesson_id: "L2-1", type: "video", video_id: "V_DIFF", start_seconds: 10, end_seconds: 100 },
        ],
      },
    ],
  };
  const okProblems = lintCurriculumData(okCurriculum, research);
  assert.deepEqual(okProblems, []);
});

// -------------------------------------------------------------
// V-02: Phát cả video lọt lint khi thiếu thời lượng hoặc null/null
// -------------------------------------------------------------
test("V-02: Lint từ chối bài video 0/0 khi thiếu duration_seconds hoặc duration_seconds = 0, và từ chối start/end là null", () => {
  const makeCurr = (s, e) => ({
    modules: [
      {
        module_id: "M1",
        lessons: [{ lesson_id: "L1-1", type: "video", video_id: "V_FULL", start_seconds: s, end_seconds: e }],
      },
    ],
    unused_primary_videos: [],
  });

  const resMissingDur = {
    videos: [{ video_id: "V_FULL", fit: "primary", segments: [] }],
  };
  const pMissing = lintCurriculumData(makeCurr(0, 0), resMissingDur);
  assert.ok(
    pMissing.some((p) => p.includes("thời-lượng-video") && p.includes("số dương")),
    `Phải báo lỗi thiếu duration_seconds: ${JSON.stringify(pMissing)}`
  );

  const resZeroDur = {
    videos: [{ video_id: "V_FULL", fit: "primary", duration_seconds: 0, segments: [] }],
  };
  const pZero = lintCurriculumData(makeCurr(0, 0), resZeroDur);
  assert.ok(
    pZero.some((p) => p.includes("thời-lượng-video") && p.includes("số dương")),
    `Phải báo lỗi duration_seconds = 0: ${JSON.stringify(pZero)}`
  );

  const resValidDur = {
    videos: [{ video_id: "V_FULL", fit: "primary", duration_seconds: 300, segments: [] }],
  };
  const pNull = lintCurriculumData(makeCurr(null, null), resValidDur);
  assert.ok(
    pNull.some((p) => p.includes("null") && (p.includes("start_seconds") || p.includes("end_seconds"))),
    `Phải báo lỗi khi start/end là null: ${JSON.stringify(pNull)}`
  );
});

// -------------------------------------------------------------
// V-03: Kiểm độ dài bài video 0/0 lấy duration_seconds từ research
// -------------------------------------------------------------
test("V-03: lesson-lint trên bài video 0/0 tính đúng thời lượng video từ research.json và báo vượt trần; thiếu research không crash", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v03-lint-"));
  const lesDir = path.join(tmpDir, "lessons");
  fs.mkdirSync(lesDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [{
        module_id: "M1",
        lessons: [{ lesson_id: "L1-1", target_minutes: 10, type: "video", video_id: "V_900", start_seconds: 0, end_seconds: 0 }],
      }],
    })
  );

  const words1000 = Array.from({ length: 1000 }, (_, i) => `từ${i}`).join(" ");
  const lessonData = {
    lesson_id: "L1-1",
    title: "Bài video 0/0",
    short_description: "Mô tả ngắn",
    summary: "Tóm tắt",
    video: {
      video_id: "V_900",
      start_seconds: 0,
      end_seconds: 0,
      caption_evidence: null,
      description_markdown: `## Mở đầu\n\nNội dung bài viết.\n\n${words1000}\n`,
    },
  };
  fs.writeFileSync(path.join(lesDir, "L1-1.json"), JSON.stringify(lessonData));

  fs.writeFileSync(
    path.join(tmpDir, "research.json"),
    JSON.stringify({
      videos: [{ video_id: "V_900", duration_seconds: 900, fit: "primary" }],
    })
  );

  const res = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /L1-1: độ-dài: ước tính 20 phút/);

  fs.unlinkSync(path.join(tmpDir, "research.json"));
  const resNoRes = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(resNoRes.status, 1);
  assert.match(resNoRes.stdout, /L1-1: thời-lượng-video/);
  assert.doesNotMatch(resNoRes.stderr, /TypeError|ReferenceError/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -------------------------------------------------------------
// V-04: lesson-lint kiểm tra đoạn phát khớp curriculum.json
// -------------------------------------------------------------
test("V-04: lesson-lint báo lỗi khi video của lesson không khớp curriculum; bài rơi về article (video: null) không bị báo", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v04-lint-"));
  const lesDir = path.join(tmpDir, "lessons");
  fs.mkdirSync(lesDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [{
        module_id: "M1",
        lessons: [{ lesson_id: "L1-1", type: "video", video_id: "V_SRC", start_seconds: 10, end_seconds: 100 }],
      }],
    })
  );

  const mismatchedLesson = {
    lesson_id: "L1-1",
    title: "Bài lệch đoạn",
    short_description: "Mô tả ngắn",
    summary: "Tóm tắt",
    video: {
      video_id: "V_SRC",
      start_seconds: 20,
      end_seconds: 100,
      caption_evidence: { cue_text_sha256: "abc" },
      description_markdown: "Nội dung bài viết.",
    },
  };
  fs.writeFileSync(path.join(lesDir, "L1-1.json"), JSON.stringify(mismatchedLesson));

  const resMismatch = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(resMismatch.status, 1);
  assert.match(resMismatch.stdout, /L1-1: khớp-curriculum:/);

  const fallbackLesson = {
    lesson_id: "L1-1",
    title: "Bài rơi về article",
    short_description: "Mô tả ngắn",
    summary: "Tóm tắt",
    video: null,
    article: { description_markdown: "Nội dung bài viết thay thế video." },
  };
  fs.writeFileSync(path.join(lesDir, "L1-1.json"), JSON.stringify(fallbackLesson));

  const resFallback = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.doesNotMatch(resFallback.stdout, /khớp-curriculum/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -------------------------------------------------------------
// V-06: lesson-lint báo lỗi và thoát 1 khi research.json bị hỏng
// -------------------------------------------------------------
test("V-06: lesson-lint báo lỗi và thoát 1 khi research.json tồn tại nhưng bị hỏng; thiếu research.json không crash", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v06-lint-"));
  const lesDir = path.join(tmpDir, "lessons");
  fs.mkdirSync(lesDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [{
        module_id: "M1",
        lessons: [{ lesson_id: "L1-1", type: "article" }],
      }],
    })
  );
  fs.writeFileSync(
    path.join(lesDir, "L1-1.json"),
    JSON.stringify({ lesson_id: "L1-1", title: "Bài 1", article: { description_markdown: "Bài viết." } })
  );

  // 1. research.json tồn tại nhưng hỏng JSON -> báo lỗi rõ ràng và thoát 1
  fs.writeFileSync(path.join(tmpDir, "research.json"), "{ invalid json");
  const resBad = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(resBad.status, 1);
  assert.match(resBad.stdout, /research\.json không đọc được:/);

  // 2. Không có file research.json -> không crash với SyntaxError, chạy bình thường
  fs.unlinkSync(path.join(tmpDir, "research.json"));
  const resNoFile = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.doesNotMatch(resNoFile.stdout, /research\.json không đọc được/);
  assert.doesNotMatch(resNoFile.stderr, /SyntaxError/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
