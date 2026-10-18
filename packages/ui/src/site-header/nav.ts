import { localizePath, type SiteLocale } from "../locales";

/** A destination inside a mega-menu group, or a top-level link when the group has no items. */
export type SiteNavLink = {
  label: string;
  description?: string;
  href: string;
};

export type SiteNavGroup = {
  id: string;
  label: string;
  href?: string;
  items?: SiteNavLink[];
};

type Copy = {
  learn: string; courses: string; coursesDesc: string; roadmap: string; roadmapDesc: string; cora: string; coraDesc: string;
  opportunities: string; jobs: string; jobsDesc: string; hackathons: string; hackathonsDesc: string;
  community: string; blog: string; blogDesc: string; caseStudies: string; caseStudiesDesc: string;
  universities: string; universitiesDesc: string;
  about: string; aboutUs: string; aboutUsDesc: string; contact: string; contactDesc: string;
  signIn: string; signUp: string; goToApp: string; language: string; menu: string; closeMenu: string; mainNav: string;
};

/** Header copy for every site locale; both the landing site and the app render from this. */
export const SITE_HEADER_COPY: Record<SiteLocale, Copy> = {
  en: {
    learn: "Learn", courses: "Courses", coursesDesc: "Hands-on Web3 and blockchain courses",
    roadmap: "Roadmap", roadmapDesc: "Structured paths from basics to builder", cora: "Cora", coraDesc: "Your AI learning companion",
    opportunities: "Opportunities", jobs: "Jobs", jobsDesc: "Web3 roles from partner companies",
    hackathons: "Hackathons", hackathonsDesc: "Build, compete and win prizes",
    community: "Community", blog: "Blog", blogDesc: "News, events and learning methods",
    caseStudies: "Case studies", caseStudiesDesc: "Programs we run with partners",
    universities: "Universities", universitiesDesc: "Campus partnerships",
    about: "About", aboutUs: "About Corelia", aboutUsDesc: "Our mission and team", contact: "Contact", contactDesc: "Talk to our team",
    signIn: "Log in", signUp: "Sign up", goToApp: "Go to learning", language: "Language", menu: "Open menu", closeMenu: "Close menu", mainNav: "Main navigation",
  },
  vi: {
    learn: "Học", courses: "Khóa học", coursesDesc: "Khóa học Web3 và blockchain thực chiến",
    roadmap: "Lộ trình", roadmapDesc: "Lộ trình từ nền tảng đến builder", cora: "Cora", coraDesc: "Trợ lý học tập AI",
    opportunities: "Cơ hội", jobs: "Việc làm", jobsDesc: "Việc làm Web3 từ doanh nghiệp đối tác",
    hackathons: "Hackathon", hackathonsDesc: "Xây dựng, thi đấu và giành giải thưởng",
    community: "Cộng đồng", blog: "Blog", blogDesc: "Tin tức, sự kiện và phương pháp học",
    caseStudies: "Dự án tiêu biểu", caseStudiesDesc: "Chương trình triển khai cùng đối tác",
    universities: "Đại học", universitiesDesc: "Hợp tác với các trường",
    about: "Giới thiệu", aboutUs: "Về Corelia", aboutUsDesc: "Sứ mệnh và đội ngũ", contact: "Liên hệ", contactDesc: "Trao đổi với đội ngũ",
    signIn: "Đăng nhập", signUp: "Đăng ký", goToApp: "Vào học", language: "Ngôn ngữ", menu: "Mở menu", closeMenu: "Đóng menu", mainNav: "Điều hướng chính",
  },
  "zh-CN": {
    learn: "学习", courses: "课程", coursesDesc: "实战型 Web3 与区块链课程",
    roadmap: "学习路线", roadmapDesc: "从基础到开发者的系统路线", cora: "Cora", coraDesc: "你的 AI 学习助手",
    opportunities: "机会", jobs: "职位", jobsDesc: "合作企业的 Web3 职位",
    hackathons: "黑客松", hackathonsDesc: "动手构建、参赛赢奖",
    community: "社区", blog: "博客", blogDesc: "新闻、活动与学习方法",
    caseStudies: "案例", caseStudiesDesc: "与合作伙伴开展的项目",
    universities: "高校", universitiesDesc: "校园合作",
    about: "关于", aboutUs: "关于 Corelia", aboutUsDesc: "使命与团队", contact: "联系我们", contactDesc: "与团队交流",
    signIn: "登录", signUp: "注册", goToApp: "开始学习", language: "语言", menu: "打开菜单", closeMenu: "关闭菜单", mainNav: "主导航",
  },
  "zh-TW": {
    learn: "學習", courses: "課程", coursesDesc: "實戰型 Web3 與區塊鏈課程",
    roadmap: "學習路線", roadmapDesc: "從基礎到開發者的系統路線", cora: "Cora", coraDesc: "你的 AI 學習助手",
    opportunities: "機會", jobs: "職缺", jobsDesc: "合作企業的 Web3 職缺",
    hackathons: "黑客松", hackathonsDesc: "動手打造、參賽贏獎",
    community: "社群", blog: "部落格", blogDesc: "新聞、活動與學習方法",
    caseStudies: "案例", caseStudiesDesc: "與合作夥伴推動的計畫",
    universities: "大學", universitiesDesc: "校園合作",
    about: "關於", aboutUs: "關於 Corelia", aboutUsDesc: "使命與團隊", contact: "聯絡我們", contactDesc: "與團隊聯繫",
    signIn: "登入", signUp: "註冊", goToApp: "開始學習", language: "語言", menu: "開啟選單", closeMenu: "關閉選單", mainNav: "主要導覽",
  },
  ko: {
    learn: "학습", courses: "강좌", coursesDesc: "실전 Web3·블록체인 강좌",
    roadmap: "로드맵", roadmapDesc: "기초부터 빌더까지 체계적인 경로", cora: "Cora", coraDesc: "AI 학습 도우미",
    opportunities: "기회", jobs: "채용", jobsDesc: "파트너사의 Web3 채용",
    hackathons: "해커톤", hackathonsDesc: "만들고, 겨루고, 수상하세요",
    community: "커뮤니티", blog: "블로그", blogDesc: "소식, 이벤트, 학습 방법",
    caseStudies: "사례", caseStudiesDesc: "파트너와 함께한 프로그램",
    universities: "대학", universitiesDesc: "캠퍼스 파트너십",
    about: "소개", aboutUs: "Corelia 소개", aboutUsDesc: "미션과 팀", contact: "문의", contactDesc: "팀에 문의하기",
    signIn: "로그인", signUp: "회원가입", goToApp: "학습하러 가기", language: "언어", menu: "메뉴 열기", closeMenu: "메뉴 닫기", mainNav: "주 메뉴",
  },
  ja: {
    learn: "学ぶ", courses: "コース", coursesDesc: "実践的な Web3・ブロックチェーン講座",
    roadmap: "ロードマップ", roadmapDesc: "基礎からビルダーまでの体系的な道筋", cora: "Cora", coraDesc: "AI 学習アシスタント",
    opportunities: "チャンス", jobs: "求人", jobsDesc: "パートナー企業の Web3 求人",
    hackathons: "ハッカソン", hackathonsDesc: "作って、競って、賞を獲得",
    community: "コミュニティ", blog: "ブログ", blogDesc: "ニュース、イベント、学習法",
    caseStudies: "導入事例", caseStudiesDesc: "パートナーとのプログラム",
    universities: "大学", universitiesDesc: "キャンパス連携",
    about: "概要", aboutUs: "Corelia について", aboutUsDesc: "ミッションとチーム", contact: "お問い合わせ", contactDesc: "チームに相談する",
    signIn: "ログイン", signUp: "新規登録", goToApp: "学習へ進む", language: "言語", menu: "メニューを開く", closeMenu: "メニューを閉じる", mainNav: "メインナビゲーション",
  },
  es: {
    learn: "Aprender", courses: "Cursos", coursesDesc: "Cursos prácticos de Web3 y blockchain",
    roadmap: "Ruta", roadmapDesc: "Rutas estructuradas de lo básico a builder", cora: "Cora", coraDesc: "Tu asistente de aprendizaje con IA",
    opportunities: "Oportunidades", jobs: "Empleos", jobsDesc: "Empleos Web3 de empresas aliadas",
    hackathons: "Hackathons", hackathonsDesc: "Construye, compite y gana premios",
    community: "Comunidad", blog: "Blog", blogDesc: "Noticias, eventos y métodos de aprendizaje",
    caseStudies: "Casos de éxito", caseStudiesDesc: "Programas con nuestros aliados",
    universities: "Universidades", universitiesDesc: "Alianzas con campus",
    about: "Nosotros", aboutUs: "Sobre Corelia", aboutUsDesc: "Nuestra misión y equipo", contact: "Contacto", contactDesc: "Habla con el equipo",
    signIn: "Iniciar sesión", signUp: "Registrarse", goToApp: "Ir a aprender", language: "Idioma", menu: "Abrir menú", closeMenu: "Cerrar menú", mainNav: "Navegación principal",
  },
};

/**
 * Site navigation. Paths point at the landing site (domain root) and are localised;
 * marketing pages that only exist in English and Vietnamese fall back to English there.
 */
export function siteNavigation(locale: SiteLocale): SiteNavGroup[] {
  const c = SITE_HEADER_COPY[locale];
  const to = (path: string) => localizePath(path, locale);
  return [
    {
      id: "learn", label: c.learn, items: [
        { label: c.courses, description: c.coursesDesc, href: to("/courses") },
        { label: c.roadmap, description: c.roadmapDesc, href: to("/roadmap") },
        { label: c.cora, description: c.coraDesc, href: to("/cora") },
      ],
    },
    {
      id: "opportunities", label: c.opportunities, items: [
        { label: c.jobs, description: c.jobsDesc, href: to("/jobs") },
        { label: c.hackathons, description: c.hackathonsDesc, href: to("/hackathons") },
      ],
    },
    {
      id: "community", label: c.community, items: [
        { label: c.blog, description: c.blogDesc, href: to("/blog") },
        { label: c.caseStudies, description: c.caseStudiesDesc, href: to("/case-studies") },
        { label: c.universities, description: c.universitiesDesc, href: to("/universities") },
      ],
    },
    {
      id: "about", label: c.about, items: [
        { label: c.aboutUs, description: c.aboutUsDesc, href: to("/about") },
        { label: c.contact, description: c.contactDesc, href: to("/contact") },
      ],
    },
  ];
}
