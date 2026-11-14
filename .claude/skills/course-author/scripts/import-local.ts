// Script import khóa học vào Supabase LOCAL stack qua Deno.
// Tái hiện đầy đủ hành vi kiểm chứng của Studio: validateLesson, validateQuestion, validateResources, checkDiagram, renderDiagramPng.
// Chỉ nhắm stack local (http://127.0.0.1:54321 và container supabase_db_corelia-app).
// Chạy: SERVICE_KEY=<local_service_role> deno run -A --no-config import-local.ts <thư-mục-khóa> [--dry-run]
import * as path from "jsr:@std/path@1";
import { getStuckLessons } from "./course-status-lib.mjs";
import {
  resolveCascadingStuckLessons,
  buildRelabeler,
  relabelObject,
} from "./labels-lib.mjs";
import {
  checkDiagram,
  layoutIssues,
  wordingIssues,
  LESSON_DIAGRAM_WIDTH,
  type Diagram,
} from "../../../../supabase/functions/corelia-api/studio/diagram.ts";
import {
  appImagePath,
  diagramFile,
  publishMarkdown,
  renderDiagramPng,
} from "../../../../supabase/functions/corelia-api/studio/diagram_render.ts";
import {
  validateLesson,
  validateQuestion,
  validateResources,
} from "../../../../supabase/functions/corelia-api/studio/lesson_ports.ts";

const rawArgs = Deno.args.filter((a) => !a.startsWith("--"));
const isDryRun = Deno.args.includes("--dry-run");
const targetDir = rawArgs[0] ? path.resolve(rawArgs[0]) : Deno.cwd();

// Tự động xác định danh sách bài bị kẹt bằng logic chung với course-status.mjs (mọi bài không ở trạng thái "đạt")
let autoStuckLessons: string[];
try {
  autoStuckLessons = getStuckLessons(targetDir);
} catch (err: any) {
  console.error(`Không thể xác định trạng thái bài học từ ${targetDir}: ${err.message}`);
  Deno.exit(1);
}
const stuckLessonSet = new Set<string>(autoStuckLessons);

// Cờ CLI --stuck-lessons=<id1,id2> nếu có thì cộng thêm vào danh sách, không thay thế
const stuckArg = Deno.args.find((a) => a.startsWith("--stuck-lessons="))?.slice("--stuck-lessons=".length);
if (stuckArg) {
  const cliStuckLessons = stuckArg.split(",").map((s) => s.trim()).filter(Boolean);
  for (const id of cliStuckLessons) {
    stuckLessonSet.add(id);
  }
}

let serviceKey = Deno.env.get("SERVICE_KEY");

if (!isDryRun && !serviceKey) {
  // Thử tự động lấy SERVICE_KEY từ supabase status của stack local
  try {
    const cmd = new Deno.Command("supabase", {
      args: ["status", "-o", "json"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    if (output.success) {
      const parsed = JSON.parse(new TextDecoder().decode(output.stdout));
      serviceKey = parsed.SERVICE_ROLE_KEY || parsed.service_role_key || parsed.service_key;
    }
  } catch {}

  if (!serviceKey) {
    try {
      const cmd = new Deno.Command("supabase", {
        args: ["status"],
        stdout: "piped",
        stderr: "piped",
      });
      const output = await cmd.output();
      if (output.success) {
        const text = new TextDecoder().decode(output.stdout);
        const match = text.match(/service_role\s*key:\s*([^\s\r\n]+)/i);
        if (match) {
          serviceKey = match[1];
        }
      }
    } catch {}
  }

  if (!serviceKey) {
    throw new Error(
      `Không lấy được SERVICE_KEY từ local Supabase stack. Vui lòng đảm bảo stack đang chạy hoặc tự chạy lệnh: SERVICE_KEY=<key> deno run -A --no-config .claude/skills/course-author/scripts/import-local.ts "${targetDir}"`
    );
  }
}

const read = async (relPath: string) => {
  const p = path.join(targetDir, relPath);
  try {
    return JSON.parse(await Deno.readTextFile(p));
  } catch (err: any) {
    throw new Error(`Lỗi đọc file ${relPath}: ${err.message}`);
  }
};

const brief = await read("brief.json");
const curriculum = await read("curriculum.json");
const finalAssignment = await read("final_assignment.json");
let research: any = { videos: [] };
try {
  research = await read("research.json");
} catch {}

// Quản lý courseId: đọc course_id.txt khi có, nếu không sinh UUID mới
let courseId: string;
const courseIdFile = path.join(targetDir, "course_id.txt");
try {
  courseId = (await Deno.readTextFile(courseIdFile)).trim();
} catch {
  courseId = crypto.randomUUID();
  if (!isDryRun) {
    await Deno.writeTextFile(courseIdFile, courseId + "\n");
  }
}

const quote = (val: unknown) => `'${String(val ?? "").replaceAll("'", "''")}'`;
const json = (val: unknown) => `${quote(JSON.stringify(val))}::jsonb`;

const execSql = async (sql: string): Promise<string> => {
  const proc = new Deno.Command("docker", {
    args: ["exec", "-i", "supabase_db_corelia-app", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = proc.stdin.getWriter();
  await writer.write(new TextEncoder().encode(sql));
  await writer.close();
  const result = await proc.output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
};

// Khi chạy thật vào DB: kiểm tra xem khóa đã tồn tại chưa. Mặc định DỪNG để không làm mất dữ liệu thử nghiệm.
if (!isDryRun) {
  const checkCount = await execSql(
    `select count(*) from public.courses where slug=${quote(brief.slug)} or id=${quote(courseId)}`
  );
  if (checkCount !== "0") {
    throw new Error(`Khóa đã tồn tại trong database local (slug=${brief.slug} hoặc id=${courseId}); dừng để không làm mất dữ liệu thử nghiệm.`);
  }
}

let instructorId = "00000000-0000-0000-0000-000000000001";
let instructorName = "Corelia";
if (!isDryRun) {
  const iId = await execSql("select id from auth.users where email='admin@corelia.academy'");
  if (!/^[0-9a-f-]{36}$/.test(iId)) throw new Error("Expected exactly one local instructor with email admin@corelia.academy");
  instructorId = iId;
  instructorName =
    (await execSql(`select coalesce(nullif(btrim(full_name),''),'Corelia') from public.profiles where id=${quote(instructorId)}`)) ||
    "Corelia";
}

const lessonRows: string[] = [];
const questionRows: string[] = [];
const images: { path: string; bytes: Uint8Array }[] = [];
let order = 0;

// Đọc trước toàn bộ records bài học để phân tích lan truyền tham chiếu
const rawLessonsMap = new Map<string, any>();
for (const module of curriculum.modules ?? []) {
  for (const cl of module.lessons ?? []) {
    const rec = await read(`lessons/${cl.lesson_id}.json`);
    if (rec.lesson_id && rec.lesson_id !== cl.lesson_id) {
      throw new Error(`Lesson ID mismatch: ${cl.lesson_id} vs ${rec.lesson_id}`);
    }
    rawLessonsMap.set(cl.lesson_id, rec);
  }
}

// Lan truyền bài kẹt: bất kỳ bài nào tham chiếu tới bài kẹt cũng thành bài kẹt
const { stuckSet: cascadingStuckSet } = resolveCascadingStuckLessons(
  curriculum,
  stuckLessonSet,
  rawLessonsMap
);
for (const id of cascadingStuckSet) {
  stuckLessonSet.add(id);
}

// Khởi tạo hàm relabelText dựa trên các bài thực sự được publish
const relabelText = buildRelabeler(curriculum, stuckLessonSet);

// Xác định các learning outcomes bị mất bài kiểm chứng
const unverifiedOutcomes: Array<{ outcome_id: string; text: string; check_lesson_ids: string[] }> = [];
for (const outcome of curriculum.outcomes ?? []) {
  if (
    typeof outcome === "object" &&
    outcome !== null &&
    Array.isArray(outcome.check_lesson_ids) &&
    outcome.check_lesson_ids.length > 0
  ) {
    const allStuck = outcome.check_lesson_ids.every((id: string) => stuckLessonSet.has(id));
    if (allStuck) {
      unverifiedOutcomes.push({
        outcome_id: outcome.outcome_id ?? "",
        text: outcome.text ?? "",
        check_lesson_ids: outcome.check_lesson_ids,
      });
    }
  }
}

for (const module of curriculum.modules ?? []) {
  for (const cl of module.lessons ?? []) {
    const rec = rawLessonsMap.get(cl.lesson_id)!;

    // 1. Kiểm tra tài nguyên bổ trợ (resources + suggested_videos)
    const resources = [...(rec.resources ?? [])];
    for (const id of rec.suggested_videos ?? []) {
      const v = research.videos?.find((item: any) => item.video_id === id);
      if (!v) throw new Error(`Video ${id} not found in research`);
      const title = String(v.title).split(" | ")[0];
      resources.push({
        title: `Video: ${title} — ${v.channel}`,
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
    const resErrors = validateResources(resources);
    if (resErrors.length) throw new Error(`${cl.lesson_id}: resources: ${resErrors.join(", ")}`);

    // 2. Dựng markdown bài học
    let markdown =
      rec.article?.description_markdown ??
      rec.video?.description_markdown ??
      rec.practice?.instructions_markdown ??
      rec.code?.instructions ??
      "";

    if (cl.type === "practice" && rec.practice?.checklist_items?.length) {
      const steps = rec.practice.checklist_items
        .map((s: any, index: number) =>
          [
            `### Bước ${index + 1}: ${s.title ?? s.action}`,
            `**Làm:** ${s.action}`,
            `**Bạn sẽ thấy:** ${s.expected}`,
            ...(s.record ? [`**Ghi vào ghi chú:** ${s.record}`] : []),
            ...((s.common_errors ?? []).length
              ? [["**Lỗi hay gặp:**", ...s.common_errors.map((e: string) => `- ${e}`)].join("\n")]
              : []),
          ].join("\n\n")
        )
        .join("\n\n");
      markdown += `\n\n## Các bước\n\n${steps}`;
    }

    // 3. Kiểm tra và render sơ đồ
    for (const diagram of rec.article?.diagrams ?? []) {
      const spec: Diagram = {
        title: "",
        nodes: (diagram.nodes ?? []).map((n: any) => ({ shape: "box", ...n })),
        edges: (diagram.edges ?? []).map((e: any) => ({ style: "solid", label: "", crossed: false, ...e })),
      };
      const issues = [
        ...new Set([
          ...checkDiagram(spec),
          ...checkDiagram(spec, { targetWidth: LESSON_DIAGRAM_WIDTH }),
          ...layoutIssues(spec),
          ...wordingIssues(spec),
        ]),
      ];
      if (issues.length) throw new Error(`${cl.lesson_id}/${diagram.id}: sơ đồ không hợp lệ: ${issues.join("; ")}`);
      const pngBytes = await renderDiagramPng(spec, undefined, undefined, { targetWidth: LESSON_DIAGRAM_WIDTH });
      images.push({
        path: appImagePath(courseId, diagramFile(cl.lesson_id, diagram.id)),
        bytes: pngBytes,
      });
    }

    // 4. Chuẩn bị payload bài học
    const data: Record<string, unknown> = {
      title: rec.title,
      short_description: rec.short_description,
      description_markdown: publishMarkdown(markdown, courseId, cl.lesson_id),
      resources,
      lesson_format: cl.type,
      duration_seconds: rec.duration_seconds ?? 600,
    };

    if (cl.type === "video" && rec.video) {
      Object.assign(data, {
        youtube_url: rec.video.youtube_url,
        youtube_start_seconds: rec.video.start_seconds,
        youtube_end_seconds: rec.video.end_seconds > 0 ? rec.video.end_seconds : null,
      });
    }

    if (cl.type === "quiz") {
      data.quiz_config = {
        passing_ratio: (cl.pass_threshold ?? 60) / 100,
        allow_retry: true,
      };
    }

    if (cl.type === "practice" && rec.practice?.checklist_items) {
      data.practice_config = {
        mode: "checklist",
        revision: 1,
        checklist_items: rec.practice.checklist_items.map((s: any, i: number) => ({
          id: s.id ?? `step-${i + 1}`,
          label: `Bước ${i + 1}: ${s.title ?? s.action}`,
        })),
      };
    }

    if (cl.type === "code_exercise" && rec.code) {
      const code = rec.code;
      const base = {
        schema_version: 1,
        revision: 1,
        language: code.language,
        file: { path: code.file_path, starter_source: code.starter_source },
        reference_solution: code.reference_solution,
        hints: code.hints,
        mode: code.mode,
      };
      data.code_exercise_config =
        code.mode === "fill"
          ? { ...base, blanks: code.blanks }
          : { ...base, tests: (code.tests ?? []).map((t: any) => ({ ...t, type: t.type ?? t.kind })) };
    }

    if (cl.purpose === "final_check") data.is_final_check = true;

    const isLessonPublished = !stuckLessonSet.has(cl.lesson_id);
    const finalData = isLessonPublished ? relabelObject(data, relabelText) : data;

    // 5. Validate bài học qua schema cổng Studio
    const problems = validateLesson(finalData);
    if (problems.length) {
      throw new Error(`${cl.lesson_id}: validateLesson: ${JSON.stringify(problems)}`);
    }

    lessonRows.push(
      `(${quote(courseId)},${quote(cl.lesson_id)},${quote(module.module_id)},${order++},${json(finalData)},${isLessonPublished})`
    );

    // 6. Validate và chuẩn bị câu hỏi trắc nghiệm
    for (const [qIndex, q] of (rec.quiz?.questions ?? []).entries()) {
      const questionId = `${courseId}-${cl.lesson_id}-q${qIndex + 1}`.toLowerCase();
      let question = {
        id: questionId,
        type: "mcq" as const,
        question: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        locale: "vi",
      };
      if (isLessonPublished) {
        question = relabelObject(question, relabelText);
      }
      const qIssues = validateQuestion(question);
      if (qIssues.length) {
        throw new Error(`${cl.lesson_id} q${qIndex + 1}: validateQuestion: ${qIssues.join(", ")}`);
      }
      questionRows.push(
        `(${quote(question.id)},${quote(courseId)},${quote(cl.lesson_id)},${qIndex},${json(question)})`
      );
    }
  }
}

const allLessonIds = (curriculum.modules ?? []).flatMap((m: any) => (m.lessons ?? []).map((l: any) => l.lesson_id)).filter(Boolean);
const stuckCount = allLessonIds.filter((id: string) => stuckLessonSet.has(id)).length;
const totalLessons = allLessonIds.length;
const hasAnyStuck = stuckCount > 0;
const isAllStuck = totalLessons > 0 && stuckCount === totalLessons;
const isCoursePublished = !isAllStuck;

const courseData: Record<string, unknown> = {
  title: brief.title,
  slug: brief.slug,
  description: `${brief.topic}. ${brief.audience}.`,
  short_description: brief.topic,
  level: brief.level,
  learning_outcomes: (curriculum.outcomes ?? []).map((o: any) => (typeof o === "string" ? o : o.text)),
  thumbnail_url: "",
  i18n: { supported_locales: ["vi"], primary_content_locale: "vi" },
  owner_type: "corelia",
  has_sections: true,
  instructor_name: instructorName,
  final_assignment_title: finalAssignment.title,
  final_assignment_description: finalAssignment.description,
  final_assignment_instructions: finalAssignment.instructions,
  final_assignment_fields: finalAssignment.fields,
};

if (hasAnyStuck) {
  courseData.is_updating = true;
}

const sections = (curriculum.modules ?? []).map(
  (m: any, i: number) => {
    const secData = {
      title: relabelText(m.title),
      description: relabelText(m.description),
    };
    return `(${quote(courseId)},${quote(m.module_id)},${i},${json(secData)})`;
  }
);

const sqlParts = [
  "BEGIN;",
  `INSERT INTO public.courses (id,instructor_id,published,slug,data) VALUES (${quote(courseId)},${quote(instructorId)},${isCoursePublished},${quote(brief.slug)},${json(courseData)});`,
  `INSERT INTO public.course_sections (course_id,id,sort_order,data) VALUES\n${sections.join(",\n")};`,
  `INSERT INTO public.course_lessons (course_id,id,section_id,sort_order,data,published) VALUES\n${lessonRows.join(",\n")};`,
];

if (questionRows.length > 0) {
  sqlParts.push(
    `INSERT INTO public.course_section_questions (id,course_id,lesson_id,sort_order,data) VALUES\n${questionRows.join(",\n")};`
  );
}

sqlParts.push("COMMIT;");
const fullSql = sqlParts.join("\n");

const summary = {
  course_id: courseId,
  slug: brief.slug,
  published: isCoursePublished,
  is_updating: Boolean(hasAnyStuck),
  stuck_lessons: Array.from(stuckLessonSet),
  unverified_outcomes: unverifiedOutcomes.map((u) => u.outcome_id),
  sections: sections.length,
  lessons: order,
  lessons_published: order - stuckCount,
  lessons_stuck: stuckCount,
  questions: questionRows.length,
  images: images.length,
};

if (isDryRun) {
  console.log(JSON.stringify({ dry_run: true, ...summary }, null, 2));
  console.log("\n" + fullSql);
  Deno.exit(0);
}

// 7. Chạy thật trên local stack
const key = serviceKey!;
for (const image of images) {
  const response = await fetch(`http://127.0.0.1:54321/storage/v1/object/app/${image.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "image/png",
      "x-upsert": "false",
    },
    body: new Blob([new Uint8Array(image.bytes)]),
  });
  if (!response.ok) throw new Error(`Upload ảnh ${image.path} thất bại: ${response.status} ${await response.text()}`);
}

await execSql(fullSql);
console.log(JSON.stringify({ success: true, ...summary }, null, 2));
