// Bộ lọc máy móc cho lesson. Chạy: node lesson-lint.mjs <thư-mục-khóa> [lesson_id ...]
// Không có lesson_id thì kiểm mọi lesson trong lessons/. Thoát mã 1 và in từng dòng "id: luật: chi tiết" khi có lỗi.
import fs from "node:fs";
import path from "node:path";

const WORDS_PER_MINUTE = 200;
const LENGTH_TOLERANCE = 1.3;

const dir = path.resolve(process.argv[2] ?? ".");
const only = process.argv.slice(3);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

let curriculum = null;
const currPath = path.join(dir, "curriculum.json");
if (fs.existsSync(currPath)) {
  try {
    curriculum = readJson(currPath);
  } catch {}
}

const targetMinutesMap = new Map();
const curriculumLessonsById = new Map();
if (curriculum?.modules) {
  for (const m of curriculum.modules) {
    for (const l of m.lessons ?? []) {
      if (l.lesson_id) {
        curriculumLessonsById.set(l.lesson_id, l);
        if (typeof l.target_minutes === "number" && l.target_minutes > 0) {
          targetMinutesMap.set(l.lesson_id, l.target_minutes);
        }
      }
    }
  }
}

let research = null;
const resPath = path.join(dir, "research.json");
if (fs.existsSync(resPath)) {
  try {
    research = readJson(resPath);
  } catch (err) {
    console.log(`research.json không đọc được: ${err.message}`);
    process.exit(1);
  }
}
const researchVideosById = new Map((research?.videos ?? []).map((v) => [v.video_id, v]));

const labels = fs.existsSync(path.join(dir, "labels.json")) ? readJson(path.join(dir, "labels.json")) : null;
if (labels && (!labels.lessons || typeof labels.lessons !== "object" || Array.isArray(labels.lessons))) {
  console.log("labels.json sai định dạng: thiếu trường lessons hoặc lessons không phải object");
  process.exit(1);
}
const validLabels = labels ? new Set(Object.values(labels.lessons)) : null;
const lessonsDir = path.join(dir, "lessons");
if (!fs.existsSync(lessonsDir)) {
  console.log(`lessons: thư-mục: không tìm thấy thư mục lessons tại ${lessonsDir}`);
  process.exit(1);
}
const ids = only.length ? only : fs.readdirSync(lessonsDir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

const framePath = path.join(dir, "frame.md");
let frameStrings = [];
if (fs.existsSync(framePath)) {
  try {
    const frameContent = fs.readFileSync(framePath, "utf8");
    frameStrings = [...frameContent.matchAll(/"([^"\n]+)"/g)]
      .map((m) => m[1].trim())
      .filter((s) => s.length >= 6);
  } catch {}
}

const stripCode = (s) => s.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
const problems = [];
const add = (id, rule, detail) => problems.push(`${id}: ${rule}: ${detail}`);
// Cảnh báo không chặn: in ra stderr, không đổi mã thoát, không lẫn với dòng lỗi "<id>: ..." trên stdout.
const warnings = [];
const warn = (id, rule, detail) => warnings.push(`cảnh báo ${id}: ${rule}: ${detail}`);

function visibleTexts(rec) {
  const out = [];
  const push = (where, v) => { if (typeof v === "string" && v.trim()) out.push([where, v]); };
  push("short_description", rec.short_description);
  push("summary", rec.summary);
  push("article", rec.article?.description_markdown);
  (rec.article?.diagrams ?? []).forEach((d, i) => { push(`diagrams[${i}].alt`, d.alt); (d.nodes ?? []).forEach((n) => push(`diagrams[${i}].node`, n.label)); (d.edges ?? []).forEach((e) => push(`diagrams[${i}].edge`, e.label)); });
  push("video", rec.video?.description_markdown);
  (rec.quiz?.questions ?? []).forEach((q, i) => { push(`quiz.q${i + 1}.prompt`, q.prompt); push(`quiz.q${i + 1}.explanation`, q.explanation); (q.options ?? []).forEach((o) => push(`quiz.q${i + 1}.option`, o.text)); });
  push("practice.instructions", rec.practice?.instructions_markdown);
  (rec.practice?.checklist_items ?? []).forEach((s, i) => { for (const k of ["title", "action", "expected", "record"]) push(`practice.p${i + 1}.${k}`, s[k]); (s.common_errors ?? []).forEach((e) => push(`practice.p${i + 1}.common_error`, e)); });
  push("code.instructions", rec.code?.instructions);
  (rec.code?.hints ?? []).forEach((h) => push("code.hint", h));
  (rec.code?.blanks ?? []).forEach((b) => push(`code.blank.${b.id}.feedback`, b.feedback));
  return out;
}

for (const id of ids) {
  const file = path.join(dir, "lessons", `${id}.json`);
  if (!fs.existsSync(file)) { add(id, "thiếu-file", file); continue; }
  const rec = readJson(file);
  const curLesson = curriculumLessonsById.get(id);
  if (curLesson && curLesson.title) {
    if (!rec.title || !rec.title.trim()) {
      add(id, "khớp-tiêu-đề", "lesson thiếu trường title hoặc title rỗng");
    } else if (rec.title.trim() !== curLesson.title.trim()) {
      add(id, "khớp-tiêu-đề", `tiêu đề lesson "${rec.title}" không khớp với curriculum "${curLesson.title}"`);
    }
  }
  for (const [where, raw] of visibleTexts(rec)) {
    const t = stripCode(raw);
    const internal = t.match(/\b(?:L\d+-\d+|M\d+|S\d{2})\b/);
    if (internal) add(id, "mã-nội-bộ", `${where}: "${internal[0]}"`);
    // "ta" và "chúng ta" tương đương (writing.md, mục Giọng văn); chỉ chặn đại từ tự xưng.
    const pron = t.match(/(?<![\p{L}\p{N}])(?:Mình|mình (?:sẽ|thử|cùng|đã)|tôi|chúng tôi|các em)(?![\p{L}\p{N}])/u);
    if (pron) add(id, "xưng-hô", `${where}: "${pron[0].trim()}" (dùng bạn/chúng ta/ta/hãy)`);

    // W-14: Mọi "Bài N" trong chữ người học thấy phải thuộc một trong hai dạng chuẩn:
    // Dạng 1: "Part X, Bài N"
    // Dạng 2: "Part X (Bài N, Bài M...)"
    const groupRanges = [];
    const groupRegex = /Part\s+[A-Z]\s*\([^)]+\)/gi;
    let gMatch;
    while ((gMatch = groupRegex.exec(t)) !== null) {
      groupRanges.push([gMatch.index, gMatch.index + gMatch[0].length]);
    }

    const lessonRegex = /\bBài\s+\d+\b/gi;
    let lMatch;
    while ((lMatch = lessonRegex.exec(t)) !== null) {
      const mIndex = lMatch.index;
      const mLen = lMatch[0].length;
      const prefix = t.slice(0, mIndex);
      const isSingleFormat = /Part\s+[A-Z]\s*,\s*$/i.test(prefix);
      const isGroupFormat = groupRanges.some(([start, end]) => mIndex >= start && mIndex + mLen <= end);

      if (!isSingleFormat && !isGroupFormat) {
        add(id, "nhãn-bài", `${where}: "${lMatch[0]}" tham chiếu bài ngoài dạng chuẩn (cần dùng "Part X, Bài N" hoặc "Part X (Bài N, Bài M...)")`);
      }
    }

    if (validLabels) for (const m of t.matchAll(/Part [A-H], Bài \d+/g)) if (!validLabels.has(m[0])) add(id, "nhãn-bài", `${where}: "${m[0]}" không có trong labels.json`);
  }

  const md = rec.article?.description_markdown ?? "";
  if (rec.article) {
    const targetMins = targetMinutesMap.get(id);
    if (typeof targetMins === "number" && targetMins > 0) {
      const textWithoutCode = stripCode(md);
      const wordCount = textWithoutCode.trim().split(/\s+/).filter(Boolean).length;
      const estMinutes = wordCount / WORDS_PER_MINUTE;
      if (estMinutes > targetMins * LENGTH_TOLERANCE) {
        add(id, "độ-dài", `ước tính ${Math.round(estMinutes)} phút (${wordCount} từ, vượt target_minutes ${targetMins} × ${LENGTH_TOLERANCE})`);
      }
    }

    const refs = [...md.matchAll(/\(diagram:([^)]+)\)/g)].map((m) => m[1]);
    const have = (rec.article.diagrams ?? []).map((d) => d.id);
    for (const r of refs) if (!have.includes(r)) add(id, "sơ-đồ", `tham chiếu ${r} không có trong diagrams`);
    for (const h of have) if (refs.filter((r) => r === h).length !== 1) add(id, "sơ-đồ", `${h} phải được tham chiếu đúng một lần`);
  }

  if (rec.video) {
    const currLesson = curriculumLessonsById.get(id);
    if (currLesson) {
      if (currLesson.type !== "video") {
        add(id, "khớp-curriculum", `lesson có video nhưng curriculum quy định type "${currLesson.type}"`);
      } else {
        if (currLesson.video_id != null && rec.video.video_id !== currLesson.video_id) {
          add(id, "khớp-curriculum", `video_id "${rec.video.video_id}" không khớp video_id "${currLesson.video_id}" trong curriculum`);
        }
        if (currLesson.start_seconds != null && rec.video.start_seconds !== currLesson.start_seconds) {
          add(id, "khớp-curriculum", `start_seconds ${rec.video.start_seconds} không khớp start_seconds ${currLesson.start_seconds} trong curriculum`);
        }
        if (currLesson.end_seconds != null && rec.video.end_seconds !== currLesson.end_seconds) {
          add(id, "khớp-curriculum", `end_seconds ${rec.video.end_seconds} không khớp end_seconds ${currLesson.end_seconds} trong curriculum`);
        }
      }
    }

    const targetMins = targetMinutesMap.get(id);
    if (typeof targetMins === "number" && targetMins > 0) {
      const vMd = rec.video.description_markdown ?? rec.article?.description_markdown ?? "";
      const textWithoutCode = stripCode(vMd);
      const wordCount = textWithoutCode.trim().split(/\s+/).filter(Boolean).length;
      const readingMinutes = wordCount / WORDS_PER_MINUTE;
      let playbackSeconds = 0;
      let hasPlaybackDuration = false;

      const isWholeVideo = (rec.video.start_seconds === 0 && rec.video.end_seconds === 0);
      if (isWholeVideo) {
        const vCand = researchVideosById.get(rec.video.video_id);
        if (vCand && typeof vCand.duration_seconds === "number" && vCand.duration_seconds > 0) {
          playbackSeconds = vCand.duration_seconds;
          hasPlaybackDuration = true;
        } else {
          add(id, "thời-lượng-video", `phát cả video (0/0) nhưng không tìm thấy duration_seconds hợp lệ cho video "${rec.video.video_id}" trong research.json`);
        }
      } else if (typeof rec.video.start_seconds === "number" && typeof rec.video.end_seconds === "number" && rec.video.end_seconds > rec.video.start_seconds) {
        playbackSeconds = rec.video.end_seconds - rec.video.start_seconds;
        hasPlaybackDuration = true;
      }

      if (hasPlaybackDuration) {
        const videoMinutes = playbackSeconds / 60;
        const estMinutes = videoMinutes + readingMinutes;
        if (estMinutes > targetMins * LENGTH_TOLERANCE) {
          add(id, "độ-dài", `ước tính ${Math.round(estMinutes)} phút (${Math.round(videoMinutes)} phút video + ${wordCount} từ, vượt target_minutes ${targetMins} × ${LENGTH_TOLERANCE})`);
        }
      }
    }
  }

  if (rec.quiz) {
    const qs = rec.quiz.questions ?? [];
    const idx = {};
    qs.forEach((q, i) => {
      idx[q.correct_index] = (idx[q.correct_index] ?? 0) + 1;
      const lens = (q.options ?? []).map((o) => o.text.length);
      const c = lens[q.correct_index], others = lens.filter((_, k) => k !== q.correct_index);
      if (c === undefined) { add(id, "quiz", `q${i + 1}: correct_index ngoài phạm vi`); return; }
      // Độ dài phương án không phải tiêu chí chấm (roles/05-lesson/quiz.md); chỉ cảnh báo để người viết tự xem lại.
      if (c > Math.max(...others) * 1.25) warn(id, "quiz-độ-dài", `q${i + 1}: đáp án đúng dài hơn hẳn nhiễu (${c} so với ${others.join("/")})`);
      if (c < Math.min(...others) * 0.5) warn(id, "quiz-độ-dài", `q${i + 1}: đáp án đúng ngắn hơn hẳn nhiễu (${c} so với ${others.join("/")})`);
      if (!q.explanation || q.explanation.length < 40) add(id, "quiz", `q${i + 1}: explanation quá ngắn`);
    });
    if (qs.length >= 5) for (const [k, n] of Object.entries(idx)) if (n / qs.length > 0.5) add(id, "quiz-vị-trí", `${n}/${qs.length} câu có đáp án đúng ở vị trí ${k}`);
  }

  if (rec.code?.mode === "fill") {
    const markers = [...(rec.code.starter_source ?? "").matchAll(/\{\{blank:([^}]+)\}\}/g)].map((m) => m[1]);
    const blanks = (rec.code.blanks ?? []).map((b) => b.id);
    if (blanks.length < 1 || blanks.length > 5) add(id, "fill", `số chỗ điền ${blanks.length} ngoài 1–5`);
    if (markers.slice().sort().join() !== blanks.slice().sort().join()) add(id, "fill", "marker trong starter không khớp blanks");
    if (/test\w* (?:bên dưới|dưới đây) kiểm tra/i.test(rec.code.instructions ?? "")) add(id, "fill", "instructions hứa app chạy test");
  }

  if (rec.practice) (rec.practice.checklist_items ?? []).forEach((s, i) => {
    if ((s.title ?? "").length > 60) add(id, "practice", `p${i + 1}: title > 60 ký tự`);
    if (!s.action || !s.expected) add(id, "practice", `p${i + 1}: thiếu action hoặc expected`);
  });

  if (frameStrings.length > 0) {
    const codeSnippets = [];
    if (rec.article?.description_markdown) {
      const cbs = [...rec.article.description_markdown.matchAll(/```[\w]*\n([\s\S]*?)```/g)].map((m) => m[1]);
      codeSnippets.push(...cbs);
    }
    if (rec.code?.starter_source) codeSnippets.push(rec.code.starter_source);
    if (rec.code?.solution_source) codeSnippets.push(rec.code.solution_source);
    if (rec.practice?.instructions_markdown) {
      const pbs = [...rec.practice.instructions_markdown.matchAll(/```[\w]*\n([\s\S]*?)```/g)].map((m) => m[1]);
      codeSnippets.push(...pbs);
    }
    const literals = [];
    for (const snip of codeSnippets) {
      const matches = [...snip.matchAll(/"([^"\n]+)"/g)].map((m) => m[1].trim());
      literals.push(...matches);
    }
    for (const [, raw] of visibleTexts(rec)) {
      const qm = [...raw.matchAll(/"([^"\n]+)"/g)].map((m) => m[1].trim());
      literals.push(...qm);
    }

    const checkedLiterals = new Set();
    for (const lit of literals) {
      if (lit.length < 6 || checkedLiterals.has(lit)) continue;
      checkedLiterals.add(lit);
      if (frameStrings.includes(lit)) continue;
      for (const fStr of frameStrings) {
        const dist = levenshtein(lit, fStr);
        if (dist >= 1 && dist <= 2) {
          add(id, "frame-chuỗi", `"${lit}" lệch so với frame.md "${fStr}" (khoảng cách ${dist})`);
        }
      }
    }
  }

  const needsRun = /```/.test(md) || rec.code || rec.practice;
  if (needsRun && !fs.existsSync(path.join(dir, "verification", `${id}.md`))) add(id, "verification", "thiếu verification/<id>.md");
}

if (warnings.length) console.error(warnings.join("\n"));
if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
console.log(`ok: ${ids.length} lesson`);
