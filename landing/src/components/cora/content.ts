export type CoraLang = "vi" | "en";

export type CoraItem = {
  title: string;
  description: string;
};

export type CoraSurface = CoraItem & {
  eyebrow: string;
};

export type CoraPageContent = {
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
  badge: string;
  title: string;
  description: string;
  proof: string[];
  primaryCta: string;
  secondaryCta: string;
  surfaceTitle: string;
  surfaceDescription: string;
  surfaces: CoraSurface[];
  benefitTitle: string;
  benefitDescription: string;
  benefits: CoraItem[];
  principleTitle: string;
  principleDescription: string;
  principles: CoraItem[];
  promptTitle: string;
  promptDescription: string;
  prompts: string[];
  ctaTitle: string;
  ctaDescription: string;
  cta: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
};

export type CoraHighlightContent = {
  badge: string;
  title: string;
  description: string;
  pills: string[];
  cards: CoraItem[];
  primaryCta: string;
  secondaryCta: string;
};

const viPage: CoraPageContent = {
  metaTitle: "Cora AI Tutor - Người bạn học AI của Corelia Academy",
  metaDescription:
    "Khám phá Cora AI Tutor trong Corelia Academy: AI đồng hành theo tiến độ học, hỗ trợ trong bài học, gợi ý khóa phù hợp và định hướng bước tiếp theo.",
  canonicalPath: "/vi/cora",
  badge: "AI Tutor cho hành trình học lập trình",
  title: "Cora là AI tutor nằm ngay trong nền tảng Corelia E-Learning.",
  description:
    "Cora xuất hiện trên dashboard, trong lesson và ở các route khám phá. Nó đọc ngữ cảnh hiện tại để trả lời đúng course, đúng bài học và đúng bước tiếp theo.",
  proof: [
    "Hiểu context theo route học tập",
    "Gợi ý course, track, activity và next step",
    "Ghi nhớ learning profile theo thời gian",
  ],
  primaryCta: "Đăng nhập để trải nghiệm",
  secondaryCta: "Xem Cora dùng thế nào",
  surfaceTitle: "Cora có những gì",
  surfaceDescription: "Ba cách dùng chính của Cora trong app.",
  surfaces: [
    {
      eyebrow: "Dashboard AI Assistant",
      title: "Copilot ngay trên trang chủ học tập",
      description:
        "Cora đọc course đang học, tiến độ, learning memory và recommended actions để nhắc bạn nên ưu tiên điều gì ở thời điểm hiện tại.",
    },
    {
      eyebrow: "Course AI Tutor",
      title: "Tutor nằm ngay trong course và lesson",
      description:
        "Khi learner đang ở trong bài học, Cora trả lời theo đúng lesson context, giải thích thực chiến hơn và gợi mở thay vì spoil thẳng đáp án.",
    },
    {
      eyebrow: "Global Cora Assistant",
      title: "Advisor theo ngữ cảnh trên toàn nền tảng",
      description:
        "Ở courses, career, projects, hackathons hay account, Cora đổi vai để tư vấn khóa học, lộ trình và hoạt động phù hợp hơn với mục tiêu hiện tại.",
    },
  ],
  benefitTitle: "Cora giúp gì cho learner",
  benefitDescription: "Đây là những gì Cora thực sự làm trong app.",
  benefits: [
    {
      title: "Hiểu bối cảnh học chứ không chỉ hiểu câu hỏi",
      description:
        "Cora có thể bám theo lesson, course, progress và learning profile để giải thích sát hơn với trạng thái học hiện tại.",
    },
    {
      title: "Định hướng bước tiếp theo cụ thể",
      description:
        "Từ dashboard đến discovery và career, Cora có thể đề xuất học tiếp gì, học khóa nào hoặc chọn track nào trước.",
    },
    {
      title: "Nhớ điểm mạnh, điểm yếu và style học",
      description:
        "Learning memory giúp câu trả lời dần cá nhân hóa theo weak topics, strong topics và cách learner tiếp thu tốt nhất.",
    },
    {
      title: "Giữ giọng điệu thực tế và thân thiện",
      description:
        "Cora ưu tiên giải thích ngắn, ví dụ cụ thể và việc có thể làm tiếp ngay.",
    },
  ],
  principleTitle: "Nguyên tắc trải nghiệm",
  principleDescription: "Cora được giới hạn khá rõ để hữu ích hơn.",
  principles: [
    {
      title: "Practical over theoretical",
      description:
        "Ưu tiên hướng dẫn thực hành, ví dụ cụ thể và next action có thể làm ngay sau khi đọc câu trả lời.",
    },
    {
      title: "Không bịa, không phán xét",
      description:
        "Nếu không chắc thì nói không chắc, không phán xét trình độ người học và không nhận dữ liệu mình không thực sự có.",
    },
    {
      title: "Hỗ trợ học thật, không học hộ",
      description:
        "Trong bài tập và quiz, Cora thiên về gợi mở và Socratic method để learner vẫn phải tự suy luận và tiến bộ thật.",
    },
  ],
  promptTitle: "Một vài câu hỏi phù hợp để bắt đầu",
  promptDescription: "Các câu hỏi này hợp với cách Cora đang được dùng trong app.",
  prompts: [
    "Mình đang học dở khóa nào và nên tiếp tục từ bài nào trước?",
    "Giải thích lại topic này theo cách dễ hiểu hơn và cho mình một ví dụ code.",
    "Nếu mục tiêu của mình là AI Product Builder thì nên chọn track nào trước?",
    "So sánh hai khóa học phù hợp cho beginner React hoặc backend.",
    "Dựa trên tiến độ hiện tại, tuần này mình nên tập trung vào điều gì?",
    "Mình nên chuẩn bị gì để tham gia project hoặc hackathon tiếp theo?",
  ],
  ctaTitle:
    "Đăng nhập vào Corelia để dùng Cora với dữ liệu học thật của bạn.",
  ctaDescription:
    "Landing page chỉ giới thiệu. Giá trị chính nằm trong app, nơi Cora có lesson context, progress và learning history.",
  cta: {
    primary: "Đi đến đăng nhập",
    secondary: "Mở app Cora",
    tertiary:
      "Cora hoạt động tốt nhất khi có đầy đủ ngữ cảnh học tập và lịch sử tiến độ của bạn trong app.",
  },
};

const enPage: CoraPageContent = {
  metaTitle: "Cora AI Tutor - Corelia Academy's AI learning companion",
  metaDescription:
    "Meet Cora AI Tutor inside Corelia Academy: an AI companion that understands learning progress, helps inside lessons, recommends courses, and guides next steps.",
  canonicalPath: "/cora",
  badge: "AI tutor for the developer learning journey",
  title: "Cora is an AI tutor built directly into the Corelia E-Learning platform.",
  description:
    "Cora appears on the dashboard, inside lessons, and across discovery routes. It reads the active context so it can answer against the current course, lesson, and next step.",
  proof: [
    "Aware of the active learning context",
    "Recommends courses, tracks, activities, and next steps",
    "Builds long-term learning memory over time",
  ],
  primaryCta: "Log in to try Cora",
  secondaryCta: "See how Cora works",
  surfaceTitle: "What Cora does",
  surfaceDescription: "Three main ways Cora is used inside the app.",
  surfaces: [
    {
      eyebrow: "Dashboard AI Assistant",
      title: "A copilot directly on the learner home",
      description:
        "Cora reads active course progress, learning memory, and recommended actions so it can guide what matters most right now.",
    },
    {
      eyebrow: "Course AI Tutor",
      title: "A tutor embedded in course and lesson flow",
      description:
        "When the learner is inside a lesson, Cora answers with lesson-aware context, explains in a more practical way, and nudges thinking instead of spoiling answers outright.",
    },
    {
      eyebrow: "Global Cora Assistant",
      title: "A context-aware advisor across the platform",
      description:
        "On routes like courses, career, projects, hackathons, and account, Cora shifts roles to guide discovery, planning, and next-step decisions.",
    },
  ],
  benefitTitle: "What Cora gives the learner",
  benefitDescription: "These are the practical things Cora already does in the app.",
  benefits: [
    {
      title: "Understand the learning situation, not only the question",
      description:
        "Cora can anchor itself to the lesson, course, progress, and learning profile so the explanation matches the learner's actual state.",
    },
    {
      title: "Recommend concrete next steps",
      description:
        "From dashboard guidance to discovery and career planning, Cora can suggest what to study next, which course fits, or which track should come first.",
    },
    {
      title: "Remember strengths, gaps, and learning style",
      description:
        "Its learning memory layer helps personalize responses using weak topics, strong topics, and the learner's preferred way of understanding.",
    },
    {
      title: "Stay practical and friendly",
      description:
        "Cora favors short explanations, concrete examples, and a clear next action.",
    },
  ],
  principleTitle: "Experience principles",
  principleDescription: "Cora is constrained on purpose so it is more useful.",
  principles: [
    {
      title: "Practical over theoretical",
      description:
        "It prioritizes hands-on guidance, concrete examples, and a next action the learner can actually take.",
    },
    {
      title: "No fabrication, no judgment",
      description:
        "If Cora is unsure, it should say so. It should not judge skill level or pretend to have data it does not really have.",
    },
    {
      title: "Support real learning instead of replacing effort",
      description:
        "In exercises and quizzes, Cora is meant to guide thinking through a Socratic approach so the learner still builds genuine understanding.",
    },
  ],
  promptTitle: "A few strong ways to begin",
  promptDescription: "These match how Cora is currently used inside the app.",
  prompts: [
    "Which course am I currently progressing through, and what should I continue next?",
    "Explain this topic in a simpler way and give me a code example.",
    "If my goal is to become an AI product builder, which track should I start with?",
    "Compare two courses that would fit a beginner in React or backend.",
    "Based on my current progress, what should I focus on this week?",
    "How should I prepare for the next project or hackathon I want to join?",
  ],
  ctaTitle:
    "Log in to Corelia and use Cora with your real learning data.",
  ctaDescription:
    "The landing page introduces Cora. The real value is inside the app, where it can use lesson context, progress, and learning history.",
  cta: {
    primary: "Go to login",
    secondary: "Open Cora in app",
    tertiary:
      "Cora works best when it can use your real learning context and progress history from the app.",
  },
};

const viHighlight: CoraHighlightContent = {
  badge: "Cora AI Tutor",
  title: "Cora AI Tutor là tính năng AI hỗ trợ học tập trong nền tảng Corelia E-Learning",
  description:
    "Từ lúc tìm khóa học, đang học lesson, đến lúc cần biết nên làm gì tiếp theo, Cora luôn bám theo đúng context hiện tại.",
  pills: [
    "Dashboard copilot",
    "Lesson-aware tutor",
    "Course & career advisor",
  ],
  cards: [
    {
      title: "Hiểu progress và context thật",
      description:
        "Cora có thể bám theo course đang học, lesson hiện tại và learning memory thay vì trả lời theo kiểu chung chung.",
    },
    {
      title: "Gợi ý step tiếp theo rõ ràng",
      description:
        "Từ câu hỏi học gì tiếp, chọn track nào, đến chuẩn bị cho project hay hackathon, Cora được thiết kế để đưa ra gợi ý cụ thể.",
    },
    {
      title: "Đưa người học vào trải nghiệm app",
      description:
        "Trang này dẫn người dùng tới đúng nơi Cora mạnh nhất: trong app, với progress và learning history thật.",
    },
  ],
  primaryCta: "Khám phá Cora",
  secondaryCta: "Đăng nhập trải nghiệm",
};

const enHighlight: CoraHighlightContent = {
  badge: "Cora AI Tutor",
  title: "Cora AI Tutor is the AI learning support feature inside the Corelia E-Learning platform",
  description:
    "From course discovery to in-lesson help and next-step guidance, Cora stays anchored to the learner's active context.",
  pills: [
    "Dashboard copilot",
    "Lesson-aware tutor",
    "Course & career advisor",
  ],
  cards: [
    {
      title: "Understands real progress and context",
      description:
        "Cora can stay grounded in the active course, current lesson, and learning memory instead of answering in a generic way.",
    },
    {
      title: "Suggests concrete next steps",
      description:
        "From what to study next to which track to choose or how to prepare for a project or hackathon, Cora is designed to guide clearly.",
    },
    {
      title: "Pulls users into the real app experience",
      description:
        "This page points users to where Cora is strongest: inside the app, with real progress and learning history.",
    },
  ],
  primaryCta: "Explore Cora",
  secondaryCta: "Log in to try it",
};

export function getCoraPageContent(lang: CoraLang) {
  return lang === "vi" ? viPage : enPage;
}

export function getCoraHighlightContent(lang: CoraLang) {
  return lang === "vi" ? viHighlight : enHighlight;
}
