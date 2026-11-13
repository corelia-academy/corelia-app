// Gói ngữ cảnh tối thiểu cho một lesson để phục vụ child viết bài và child review.
// Chạy: node lesson-context.mjs <thư-mục-khóa> <lesson_id>
// In JSON gồm: mục lesson trong curriculum; module chứa nó; lesson liền trước/sau;
// outcomes liên quan; phần research liên quan (sources, topics kèm key_points, misconceptions, setup_steps, videos, tool_versions, stack_choice, prerequisites, open_questions); bảng nhãn; frame.md nếu có.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".");
const targetId = process.argv[3];

if (!targetId) {
  console.error("Thiếu tham số lesson_id");
  process.exit(1);
}

const currPath = path.join(dir, "curriculum.json");
if (!fs.existsSync(currPath)) {
  console.error(`Không tìm thấy curriculum.json tại ${currPath}`);
  process.exit(1);
}

const curriculum = JSON.parse(fs.readFileSync(currPath, "utf8"));
const resPath = path.join(dir, "research.json");
const research = fs.existsSync(resPath) ? JSON.parse(fs.readFileSync(resPath, "utf8")) : null;

const labelsPath = path.join(dir, "labels.json");
const labels = fs.existsSync(labelsPath) ? JSON.parse(fs.readFileSync(labelsPath, "utf8")) : null;

const allLessons = [];
let targetLesson = null;
let targetModule = null;

for (const m of curriculum.modules ?? []) {
  for (const l of m.lessons ?? []) {
    allLessons.push(l);
    if (l.lesson_id === targetId) {
      targetLesson = l;
      targetModule = m;
    }
  }
}

if (!targetLesson) {
  console.error(`Không tìm thấy lesson ${targetId} trong curriculum`);
  process.exit(1);
}

const targetIndex = allLessons.findIndex((l) => l.lesson_id === targetId);
const prevLesson = targetIndex > 0 ? allLessons[targetIndex - 1] : null;
const nextLesson = targetIndex < allLessons.length - 1 ? allLessons[targetIndex + 1] : null;

// Lọc outcomes
const outcomeIdSet = new Set(targetLesson.outcome_ids ?? []);
const relatedOutcomes = (curriculum.outcomes ?? []).filter((o) => outcomeIdSet.has(o.outcome_id));

// Lọc research
const lessonSourceIds = new Set(targetLesson.source_ids ?? []);

// Xác định các topic liên quan qua source_ids trong key_points
const directTopicIds = new Set();
for (const t of research?.topics ?? []) {
  for (const kp of t.key_points ?? []) {
    for (const sid of kp.source_ids ?? []) {
      if (lessonSourceIds.has(sid)) {
        directTopicIds.add(t.topic_id);
      }
    }
  }
}

// Thêm các topic liên quan qua evidence_source_ids của videos (bài video dùng nguồn video riêng)
const videoTopicIds = new Set();
for (const v of research?.videos ?? []) {
  if ((v.evidence_source_ids ?? []).some((sid) => lessonSourceIds.has(sid))) {
    if (v.topic_id) videoTopicIds.add(v.topic_id);
  }
}

const relatedTopicIds = new Set([...directTopicIds, ...videoTopicIds]);

const filteredSources = (research?.sources ?? []).filter((s) => lessonSourceIds.has(s.source_id));

const filteredTopics = [];
for (const t of research?.topics ?? []) {
  if (!relatedTopicIds.has(t.topic_id)) continue;
  let kps = (t.key_points ?? []).filter((kp) =>
    (kp.source_ids ?? []).some((sid) => lessonSourceIds.has(sid))
  );
  if (kps.length === 0 && videoTopicIds.has(t.topic_id) && directTopicIds.size === 0) {
    // Trường hợp bài video nguồn trỏ vào video riêng, lấy key_points của topic khớp video
    kps = t.key_points ?? [];
  }
  if (kps.length > 0) {
    filteredTopics.push({
      topic_id: t.topic_id,
      title: t.title,
      key_points: kps,
    });
  }
}

const filteredMisconceptions = (research?.misconceptions ?? []).filter(
  (m) =>
    (m.topic_id && relatedTopicIds.has(m.topic_id)) ||
    (m.source_ids ?? []).some((sid) => lessonSourceIds.has(sid))
);

const filteredSetupSteps = (research?.setup_steps ?? []).filter((s) =>
  (s.source_ids ?? []).some((sid) => lessonSourceIds.has(sid))
);

const filteredVideos = (research?.videos ?? []).filter(
  (v) =>
    (v.topic_id && relatedTopicIds.has(v.topic_id)) ||
    (v.evidence_source_ids ?? []).some((sid) => lessonSourceIds.has(sid))
);

const frameFile = path.join(dir, "frame.md");
const hasFrame = fs.existsSync(frameFile);

let prevLessonPath = null;
if (prevLesson?.lesson_id) {
  const pFile = path.join(dir, "lessons", `${prevLesson.lesson_id}.json`);
  if (fs.existsSync(pFile)) {
    prevLessonPath = (path.relative(dir, pFile) || `lessons/${prevLesson.lesson_id}.json`).replaceAll("\\", "/");
  }
}

const context = {
  lesson: targetLesson,
  module: {
    module_id: targetModule.module_id,
    title: targetModule.title,
    description: targetModule.description,
    lessons: (targetModule.lessons ?? []).map((l) => ({
      lesson_id: l.lesson_id,
      title: l.title,
      type: l.type,
    })),
  },
  prev_lesson: prevLesson,
  ...(prevLessonPath ? { prev_lesson_path: prevLessonPath } : {}),
  next_lesson: nextLesson,
  outcomes: relatedOutcomes,
  research: {
    sources: filteredSources,
    topics: filteredTopics,
    misconceptions: filteredMisconceptions,
    setup_steps: filteredSetupSteps,
    videos: filteredVideos,
    tool_versions: research?.tool_versions ?? null,
    stack_choice: research?.stack_choice ?? null,
    prerequisites: research?.prerequisites ?? [],
    open_questions: research?.open_questions ?? [],
  },
  labels: labels ?? null,
  ...(hasFrame ? { frame_path: path.relative(dir, frameFile) || "frame.md" } : {}),
};

console.log(JSON.stringify(context, null, 2));
