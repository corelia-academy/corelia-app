// Lesson formats of the Corelia app. A leaf module: steps.ts and lessons.ts both import it, and
// neither may import the other for values (they form an import cycle).

/** Lesson formats the Corelia app can render and validate for ai_generated courses. */
export const PLATFORM_FORMATS = ["video", "article", "quiz", "code_exercise", "practice"] as const;

/**
 * What each format can actually check in the app, given to every agent that picks or writes a format,
 * so a lesson never promises a check the platform cannot perform.
 */
export const PLATFORM_FORMAT_GUIDE: Record<typeof PLATFORM_FORMATS[number], string> = {
  video: "Video YouTube có sẵn (có thể cắt đoạn). Hoàn thành khi xem; không kiểm tra hiểu bài.",
  article: "Markdown kèm sơ đồ. Hoàn thành khi đọc; không kiểm tra hiểu bài.",
  quiz: "Câu hỏi trắc nghiệm một đáp án, chấm tự động theo passing_ratio. Kiểm tra hiểu khái niệm, dự đoán kết quả, đọc code.",
  code_exercise:
    "Một tệp Rust duy nhất trong trình soạn thảo, tên tệp trần main.rs hoặc lib.rs (tương ứng src/main.rs hoặc src/lib.rs của package Cargo; nền tảng không nhận đường dẫn có thư mục). Validator KHÔNG biên dịch, KHÔNG chạy, KHÔNG dùng terminal hay Cargo: chỉ so khớp mã nguồn (điền chỗ trống, chứa/không chứa chuỗi, trùng nguyên văn). Vì vậy test chứa/không chứa chuỗi có thể bị né bằng chú thích hoặc khoảng trắng: đây là giới hạn đã biết của nền tảng, không phải lỗi của bài. Chỉ dùng cho kỹ năng viết hoặc sửa mã kiểm được bằng nội dung mã.",
  practice:
    "Hướng dẫn hoặc checklist tự kiểm tra; người học tự làm và tự đánh dấu, không chấm, không nộp bài. Dùng cho thao tác trên máy người học (cài đặt, terminal, chạy lệnh Cargo, xem kết quả chạy).",
};

/** Formats available to newly generated AI curricula; saved video lessons remain renderable. */
export const AI_CURRICULUM_FORMATS = PLATFORM_FORMATS.filter(
  (format): format is Exclude<(typeof PLATFORM_FORMATS)[number], "video"> => format !== "video",
);
type AiCurriculumFormat = (typeof AI_CURRICULUM_FORMATS)[number];
export const AI_CURRICULUM_FORMAT_GUIDE: Pick<typeof PLATFORM_FORMAT_GUIDE, AiCurriculumFormat> = Object.fromEntries(
  AI_CURRICULUM_FORMATS.map((format) => [format, PLATFORM_FORMAT_GUIDE[format]]),
) as Pick<typeof PLATFORM_FORMAT_GUIDE, AiCurriculumFormat>;
