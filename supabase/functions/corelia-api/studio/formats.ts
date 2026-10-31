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
  article: "Markdown kèm sơ đồ; chỉ article có sơ đồ. Hoàn thành khi đọc; không kiểm tra hiểu bài. Sơ đồ là hình minh họa trong bài, không format nào kiểm kỹ năng đọc hoặc vẽ sơ đồ: outcome không được yêu cầu đọc hay vẽ sơ đồ, hãy diễn đạt bằng điều người học giải thích hoặc dự đoán.",
  quiz: "Câu hỏi trắc nghiệm một đáp án, chấm tự động theo passing_ratio. Kiểm tra hiểu khái niệm, dự đoán kết quả, đọc code. Không hiển thị sơ đồ, nên không kiểm được việc đọc sơ đồ.",
  code_exercise:
    "Một tệp mã nguồn trong ngôn ngữ đã chọn cho khóa, tên tệp trần không có thư mục. Validator KHÔNG biên dịch, KHÔNG chạy và KHÔNG dùng terminal: chỉ so khớp mã nguồn (điền chỗ trống, chứa/không chứa chuỗi, trùng nguyên văn). Vì vậy test chứa/không chứa chuỗi có thể bị né bằng chú thích hoặc khoảng trắng: đây là giới hạn đã biết của nền tảng, không phải lỗi của bài. Chỉ dùng cho kỹ năng viết hoặc sửa mã kiểm được bằng nội dung mã.",
  practice:
    "Hướng dẫn hoặc checklist tự kiểm tra, không chấm, không nộp bài. Chế độ hướng dẫn (không ô tick) dùng cho thực hành tự nguyện trên máy người học (cài đặt, terminal, chạy lệnh): người học tự làm, tự đối chiếu kết quả mong đợi, bỏ qua vẫn hoàn thành bài. Chế độ checklist chỉ để tự kiểm kiến thức vì phải đánh dấu đủ mục mới hoàn thành.",
};

/** Formats available to newly generated AI curricula; saved video lessons remain renderable. */
export const AI_CURRICULUM_FORMATS = PLATFORM_FORMATS.filter(
  (format): format is Exclude<(typeof PLATFORM_FORMATS)[number], "video"> => format !== "video",
);
type AiCurriculumFormat = (typeof AI_CURRICULUM_FORMATS)[number];
export const AI_CURRICULUM_FORMAT_GUIDE: Pick<typeof PLATFORM_FORMAT_GUIDE, AiCurriculumFormat> = Object.fromEntries(
  AI_CURRICULUM_FORMATS.map((format) => [format, PLATFORM_FORMAT_GUIDE[format]]),
) as Pick<typeof PLATFORM_FORMAT_GUIDE, AiCurriculumFormat>;
