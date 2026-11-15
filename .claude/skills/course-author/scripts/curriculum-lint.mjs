// Kiểm tra các ràng buộc tất định về bài video và quy tắc đặt tên trong curriculum và research.
// Chạy: node curriculum-lint.mjs <thư-mục-khóa>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_VIDEOS_PER_MODULE = 1;
export const MAX_VIDEO_SEGMENT_SECONDS = 720;
export const MAX_FULL_VIDEO_SECONDS = 900;
export const MAX_LESSON_TITLE_CHARS = 60; // mặc định chưa hiệu chỉnh
export const MAX_MODULE_TITLE_CHARS = 50; // mặc định chưa hiệu chỉnh
export const MAX_MODULE_TITLE_LENGTH = MAX_MODULE_TITLE_CHARS;
export const MAX_LESSON_TITLE_LENGTH = MAX_LESSON_TITLE_CHARS;

export const LABEL_COLON_REGEX = /^[^:]{1,40}:\s/;
export const BRACKET_TAG_REGEX = /^\[.*?\]/;
export const NUMBERING_MODULE_REGEX = /^(?:Module|Chương|Phần)\s*\d+|^\d+[\.:\-–—]/i;
export const NUMBERING_LESSON_REGEX = /^(?:Bài|Lesson)\s*\d+|^(?:Bài|Lesson|L\d+[\-.]\d+)\s*[:\-–—\d]+|^\d+[\.:\-–—]|^\d+\.\d+[\.:\-–—]/i;

export function loadForbiddenPrefixes(customLocalesPath) {
  const locPath = customLocalesPath || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../src/locales/vi/courses.json");
  if (!fs.existsSync(locPath)) {
    throw new Error(`Không đọc được file locales tại ${locPath}`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(locPath, "utf8"));
  } catch (err) {
    throw new Error(`Lỗi parse file locales tại ${locPath}: ${err.message}`);
  }
  const formats = data.learning?.formats;
  if (!formats || typeof formats !== "object") {
    throw new Error(`File locales tại ${locPath} không chứa key learning.formats hợp lệ`);
  }
  const prefixes = [
    ...Object.values(formats),
    "Quiz",
    "Bài kiểm tra",
    "Tự kiểm",
    "Tình huống",
  ];
  return Array.from(new Set(prefixes.filter(Boolean)));
}

export function lintCurriculumData(curriculum, research, options = {}) {
  const problems = [];
  const add = (id, rule, detail) => problems.push(`${id}: ${rule}: ${detail}`);

  const researchVideos = research?.videos ?? [];
  const videosById = new Map(researchVideos.map((v) => [v.video_id, v]));
  const videoFirstUsedIn = new Map();
  const usedVideoIds = new Set();
  let totalVideoLessons = 0;

  let forbiddenPrefixRegex;
  try {
    const prefixes = loadForbiddenPrefixes(options?.localesPath);
    forbiddenPrefixRegex = new RegExp(`^(?:${prefixes.join("|")})(?:\\s|$|[:\\-–—])`, "iu");
  } catch (err) {
    add("curriculum", "lỗi-locales", err.message);
    forbiddenPrefixRegex = /(?!)/;
  }
  const usedModuleTitles = new Map();
  const usedLessonTitles = new Map();

  // A-08: Chỉ áp dụng luật mental_model khi brief.mental_models có giá trị
  const brief = options?.brief;
  const mentalModels = Array.isArray(brief?.mental_models)
    ? brief.mental_models.filter((m) => typeof m === "string" && m.trim().length > 0)
    : [];
  const hasMentalModels = mentalModels.length > 0;
  const validMentalModels = new Set(mentalModels.map((m) => m.trim()));
  const referencedMentalModels = new Set();

  for (const mod of curriculum?.modules ?? []) {
    // A-08: Kiểm tra model_ref và mental_model của module
    if (hasMentalModels) {
      if (typeof mod.model_ref !== "string" || !mod.model_ref.trim()) {
        add(mod.module_id, "thiếu-model-ref", "module thiếu trường model_ref");
      } else if (!validMentalModels.has(mod.model_ref.trim())) {
        add(
          mod.module_id,
          "model-ref-không-hợp-lệ",
          `model_ref "${mod.model_ref}" không khớp mục nào trong brief.mental_models`,
        );
      } else {
        referencedMentalModels.add(mod.model_ref.trim());
      }

      if (typeof mod.mental_model !== "string" || !mod.mental_model.trim()) {
        add(mod.module_id, "thiếu-mental-model", "module thiếu mental_model");
      }
    }

    // 1. Kiểm tra quy tắc đặt tên module (N-01)
    if (typeof mod.title === "string") {
      const modTitle = mod.title.trim();
      if (modTitle.length === 0) {
        add(mod.module_id, "tiêu-đề-rỗng", "module có tiêu đề rỗng");
      } else {
        if (modTitle.length > MAX_MODULE_TITLE_CHARS) {
          add(
            mod.module_id,
            "độ-dài-tiêu-đề",
            `tiêu đề module dài ${modTitle.length} ký tự (tối đa ${MAX_MODULE_TITLE_CHARS})`,
          );
        }
        if (NUMBERING_MODULE_REGEX.test(modTitle)) {
          add(
            mod.module_id,
            "đánh-số-tiêu-đề",
            `tiêu đề module "${modTitle}" không được chứa tiền tố đánh số (UI đã hiển thị số thứ tự)`,
          );
        }
        if (LABEL_COLON_REGEX.test(modTitle)) {
          add(
            mod.module_id,
            "nhãn-hai-chấm",
            `tiêu đề module "${modTitle}" chứa mẫu nhãn kèm dấu hai chấm ở đầu`,
          );
        }
        if (usedModuleTitles.has(modTitle)) {
          const prevModId = usedModuleTitles.get(modTitle);
          add(
            mod.module_id,
            "trùng-tiêu-đề",
            `tiêu đề module "${modTitle}" trùng với module ${prevModId} trong khóa`,
          );
        } else {
          usedModuleTitles.set(modTitle, mod.module_id);
        }
      }
    }

    // 2. Kiểm tra quy tắc đặt tên lesson (N-01)
    for (const l of mod.lessons ?? []) {
      if (typeof l.title === "string") {
        const lTitle = l.title.trim();
        if (lTitle.length === 0) {
          add(l.lesson_id, "tiêu-đề-rỗng", "lesson có tiêu đề rỗng");
        } else {
          if (lTitle.length > MAX_LESSON_TITLE_CHARS) {
            add(
              l.lesson_id,
              "độ-dài-tiêu-đề",
              `tiêu đề lesson dài ${lTitle.length} ký tự (tối đa ${MAX_LESSON_TITLE_CHARS})`,
            );
          }
          if (LABEL_COLON_REGEX.test(lTitle)) {
            add(
              l.lesson_id,
              "nhãn-hai-chấm",
              `tiêu đề lesson "${lTitle}" chứa mẫu nhãn kèm dấu hai chấm ở đầu`,
            );
          }
          if (forbiddenPrefixRegex.test(lTitle)) {
            add(
              l.lesson_id,
              "tiền-tố-bị-cấm",
              `tiêu đề lesson "${lTitle}" bắt đầu bằng tiền tố bị cấm (UI đã hiển thị badge định dạng bài học)`,
            );
          }
          if (BRACKET_TAG_REGEX.test(lTitle)) {
            add(
              l.lesson_id,
              "nhãn-tiêu-đề",
              `tiêu đề lesson "${lTitle}" không được chứa mẫu nhãn trong ngoặc vuông`,
            );
          }
          if (NUMBERING_LESSON_REGEX.test(lTitle)) {
            add(
              l.lesson_id,
              "đánh-số-tiêu-đề",
              `tiêu đề lesson "${lTitle}" không được chứa tiền tố đánh số (UI đã hiển thị vị trí bài học)`,
            );
          }
          if (usedLessonTitles.has(lTitle)) {
            const prevLId = usedLessonTitles.get(lTitle);
            add(
              l.lesson_id,
              "trùng-tiêu-đề",
              `tiêu đề lesson "${lTitle}" trùng với bài ${prevLId} trong khóa`,
            );
          } else {
            usedLessonTitles.set(lTitle, l.lesson_id);
          }
        }
      }

      // A-08: Kiểm tra reinforces của code_exercise (chỉ khi brief.mental_models có giá trị)
      if (hasMentalModels && l.type === "code_exercise") {
        if (typeof l.reinforces !== "string" || !l.reinforces.trim()) {
          add(l.lesson_id, "thiếu-reinforces", "bài code_exercise thiếu trường reinforces");
        }
      }
    }

    const videoLessons = (mod.lessons ?? []).filter((l) => l.type === "video");
    if (videoLessons.length > MAX_VIDEOS_PER_MODULE) {
      add(
        mod.module_id,
        "ngân-sách-video",
        `module có ${videoLessons.length} bài video (tối đa ${MAX_VIDEOS_PER_MODULE})`,
      );
    }

    for (const l of videoLessons) {
      totalVideoLessons++;
      const videoId = l.video_id;
      if (!videoId) {
        add(l.lesson_id, "video-id", "bài video thiếu video_id");
        continue;
      }

      if (videoFirstUsedIn.has(videoId)) {
        const prevId = videoFirstUsedIn.get(videoId);
        add(
          l.lesson_id,
          "video-trùng",
          `video "${videoId}" đã được dùng ở bài ${prevId} (một video chỉ làm bài một lần trong toàn khóa)`,
        );
      } else {
        videoFirstUsedIn.set(videoId, l.lesson_id);
      }
      usedVideoIds.add(videoId);

      const cand = videosById.get(videoId);
      if (!cand) {
        add(l.lesson_id, "video-id", `video_id "${videoId}" không tồn tại trong research.videos`);
        continue;
      }

      if (cand.fit !== "primary") {
        add(
          l.lesson_id,
          "video-fit",
          `video "${videoId}" có fit "${cand.fit ?? "thiếu_fit"}" (chỉ được dùng ứng viên fit: "primary")`,
        );
      }

      if (l.start_seconds === null || l.start_seconds === undefined || l.end_seconds === null || l.end_seconds === undefined) {
        add(
          l.lesson_id,
          "thời-lượng-đoạn",
          "bài video không được để start_seconds hoặc end_seconds là null (mã hóa 0/0 khi phát cả video)",
        );
        continue;
      }

      const isWholeVideo = (l.start_seconds === 0 && l.end_seconds === 0);
      if (isWholeVideo) {
        const dur = cand.duration_seconds;
        if (typeof dur !== "number" || dur <= 0 || !Number.isFinite(dur)) {
          add(
            l.lesson_id,
            "thời-lượng-video",
            `phát cả video (0/0) cần duration_seconds là số dương <= ${MAX_FULL_VIDEO_SECONDS}s trong research.videos`,
          );
        } else if (dur > MAX_FULL_VIDEO_SECONDS) {
          add(
            l.lesson_id,
            "thời-lượng-video",
            `phát cả video có duration_seconds ${dur}s vượt trần ${MAX_FULL_VIDEO_SECONDS}s`,
          );
        }
      } else {
        const startSec = l.start_seconds;
        const endSec = l.end_seconds;
        if (typeof startSec !== "number" || typeof endSec !== "number" || startSec < 0 || endSec <= startSec) {
          add(
            l.lesson_id,
            "thời-lượng-đoạn",
            `end_seconds (${endSec}) phải lớn hơn start_seconds (${startSec})`,
          );
          continue;
        }

        const segDuration = endSec - startSec;
        if (segDuration > MAX_VIDEO_SEGMENT_SECONDS) {
          add(
            l.lesson_id,
            "thời-lượng-đoạn",
            `đoạn phát ${startSec}-${endSec} (${segDuration}s) vượt trần ${MAX_VIDEO_SEGMENT_SECONDS}s`,
          );
        }

        const matchSeg = (cand.segments ?? []).find(
          (s) => s.start_seconds === startSec && s.end_seconds === endSec,
        );
        if (!matchSeg || !matchSeg.caption_evidence || !matchSeg.caption_evidence.cue_text_sha256) {
          add(
            l.lesson_id,
            "bằng-chứng-đoạn",
            `đoạn phát ${startSec}-${endSec} không trùng segment có caption_evidence trong research.videos`,
          );
        }
      }
    }
  }

  // Giải trình cho khóa 0 video
  if (totalVideoLessons === 0) {
    if (!curriculum?.no_video_reason || typeof curriculum.no_video_reason !== "string" || !curriculum.no_video_reason.trim()) {
      add("curriculum", "giải-trình-khóa", "khóa có 0 bài video nhưng thiếu no_video_reason");
    }
  }

  // Giải trình cho ứng viên primary không dùng
  const unusedPrimaries = (curriculum?.unused_primary_videos ?? []);
  const unusedReasonByVideoId = new Map(
    unusedPrimaries
      .filter((u) => u?.video_id && typeof u.reason === "string" && u.reason.trim())
      .map((u) => [u.video_id, u.reason.trim()]),
  );

  for (const v of researchVideos) {
    if (v.fit === "primary" && !usedVideoIds.has(v.video_id)) {
      if (!unusedReasonByVideoId.has(v.video_id)) {
        add(
          "curriculum",
          "giải-trình-ứng-viên",
          `ứng viên primary "${v.video_id}" không được dùng nhưng thiếu lý do trong unused_primary_videos`,
        );
      }
    }
  }

  // A-08: Kiểm tra mọi mục trong brief.mental_models phải được ít nhất một module dạy qua model_ref
  if (hasMentalModels) {
    for (const mm of mentalModels) {
      if (!referencedMentalModels.has(mm.trim())) {
        add(
          "curriculum",
          "mô-hình-chưa-dạy",
          `mô hình tư duy "${mm}" trong brief.mental_models không có module nào dạy`,
        );
      }
    }
  }

  return problems;
}

export function lintCurriculum(courseDir, options = {}) {
  const dir = path.resolve(courseDir);
  const currFile = path.join(dir, "curriculum.json");
  if (!fs.existsSync(currFile)) {
    return [`curriculum: thiếu-file: không tìm thấy ${currFile}`];
  }
  const curriculum = JSON.parse(fs.readFileSync(currFile, "utf8"));
  const resFile = path.join(dir, "research.json");
  const research = fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile, "utf8")) : null;
  const briefFile = path.join(dir, "brief.json");
  let brief = options.brief ?? null;
  if (!brief && fs.existsSync(briefFile)) {
    try {
      brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
    } catch {}
  }

  return lintCurriculumData(curriculum, research, { ...options, brief, courseDir: dir });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const targetDir = process.argv[2] ?? ".";
  const problems = lintCurriculum(targetDir);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  } else {
    console.log("ok");
    process.exit(0);
  }
}
