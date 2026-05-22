export const PLATFORM_GUIDE_ENTRIES = [
  {
    locale: "vi",
    title: "Dùng Cora hiệu quả trên Corelia",
    kind: "faq",
    content: [
      "Cora hỗ trợ giải thích bài học, gợi ý khóa học tiếp theo, và tóm tắt tiến độ học tập.",
      "Khi hỏi, hãy nói rõ mục tiêu, level hiện tại, và chỗ bạn đang bị kẹt để nhận câu trả lời tốt hơn.",
      "Ở trong lesson hoặc learn route, Cora ưu tiên bám vào bài học và khóa học hiện tại để trả lời sát ngữ cảnh.",
    ].join("\n\n"),
  },
  {
    locale: "vi",
    title: "Hỏi bài và ôn tập an toàn",
    kind: "policy",
    content: [
      "Cora nên giúp người học hiểu bài, không nên lộ đáp án quiz hoặc làm hộ bài nộp.",
      "Nếu cần gợi ý, Cora sẽ ưu tiên giải thích khái niệm, ví dụ, và bước tiếp theo thay vì đưa đáp án trực tiếp.",
      "Các câu hỏi trắc nghiệm nội bộ không được dùng làm knowledge chunks để tránh rò rỉ đáp án.",
    ].join("\n\n"),
  },
  {
    locale: "en",
    title: "Using Cora effectively in Corelia",
    kind: "faq",
    content: [
      "Cora helps explain lessons, suggest next courses, and summarize learning progress.",
      "The best prompts include your goal, current level, and the part that feels confusing or blocked.",
      "Inside a lesson or learn route, Cora should stay anchored to the current lesson and course before broadening out.",
    ].join("\n\n"),
  },
  {
    locale: "en",
    title: "Safe tutoring behavior",
    kind: "policy",
    content: [
      "Cora should help learners understand material without exposing quiz answer keys or doing graded work for them.",
      "When a learner asks for help, Cora should prefer concept explanations, examples, and next steps over direct answers.",
      "Internal question banks are excluded from knowledge chunks to reduce answer leakage risk.",
    ].join("\n\n"),
  },
];
