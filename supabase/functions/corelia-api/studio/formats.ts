// Lesson formats of the Corelia app. A leaf module: steps.ts and lessons.ts both import it, and
// neither may import the other for values (they form an import cycle).

/** Lesson formats the Corelia app can render and validate for ai_generated courses. */
export const PLATFORM_FORMATS = ["video", "article", "quiz", "code_exercise", "practice"] as const;

/**
 * What each format can actually check in the app, given to every agent that picks or writes a format,
 * so a lesson never promises a check the platform cannot perform.
 */
export const PLATFORM_FORMAT_GUIDE: Record<typeof PLATFORM_FORMATS[number], string> = {
  video: "Video YouTube có sẵn. Hoàn thành khi xem; không kiểm tra hiểu bài.",
  article: "Markdown kèm sơ đồ; chỉ article có sơ đồ. Hoàn thành khi đọc; không kiểm tra hiểu bài. Sơ đồ là hình minh họa trong bài, không format nào kiểm kỹ năng đọc hoặc vẽ sơ đồ: outcome không được yêu cầu đọc hay vẽ sơ đồ, hãy diễn đạt bằng điều người học giải thích hoặc dự đoán.",
  quiz: "Câu hỏi trắc nghiệm một đáp án, chấm tự động theo passing_ratio. Kiểm tra hiểu khái niệm, dự đoán kết quả, đọc code. Không hiển thị sơ đồ, nên không kiểm được việc đọc sơ đồ.",
  code_exercise:
    "Bài code gồm đúng hai phần tuần tự theo cùng ngôn ngữ: part_1 là điền chỗ trống (blanks), part_2 là viết hoặc sửa code (tests); mỗi phần có file_path riêng là tên tệp trần không có thư mục. Validator KHÔNG biên dịch, KHÔNG chạy và KHÔNG dùng terminal: chỉ so khớp mã nguồn (điền chỗ trống, chứa/không chứa chuỗi, trùng nguyên văn). Vì vậy test chứa/không chứa chuỗi có thể bị né bằng chú thích hoặc khoảng trắng: đây là giới hạn đã biết của nền tảng, không phải lỗi của bài. Chỉ dùng cho kỹ năng viết hoặc sửa mã kiểm được bằng nội dung mã.",
  practice:
    "Hướng dẫn thực hành tự nguyện (mode instruction), không chấm, không nộp bài. Dùng cho thao tác trên máy người học (cài đặt, terminal, chạy lệnh): người học tự làm, tự đối chiếu kết quả mong đợi, bỏ qua vẫn hoàn thành bài. Không dùng để kiểm tra outcome.",
};

/** Formats available to newly generated AI curricula. */
export const AI_CURRICULUM_FORMATS = PLATFORM_FORMATS;
type AiCurriculumFormat = (typeof AI_CURRICULUM_FORMATS)[number];
export const AI_CURRICULUM_FORMAT_GUIDE: Record<AiCurriculumFormat, string> = Object.fromEntries(
  AI_CURRICULUM_FORMATS.map((format) => [format, PLATFORM_FORMAT_GUIDE[format]]),
) as Record<AiCurriculumFormat, string>;
