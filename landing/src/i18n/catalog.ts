import type { SiteLocale } from "@corelia/ui/locales";

/** UI copy for the catalog pages (courses, hackathons, jobs) in every site locale. */
type CatalogCopy = {
  home: string;
  coursesTitle: string; coursesIntro: string; coursesEmpty: string;
  hackathonsTitle: string; hackathonsIntro: string; hackathonsEmpty: string;
  jobsTitle: string; jobsIntro: string; jobsEmpty: string;
  viewDetails: string; startLearning: string; outcomes: string; skills: string; about: string;
  level: string; duration: string; hours: string; instructor: string; levels: Record<string, string>;
  joinHackathon: string; starts: string; ends: string; host: string; participants: string; prizes: string;
  modes: Record<string, string>; statuses: Record<string, string>;
  applyNow: string; viewInApp: string; posted: string; location: string; remote: string; salary: string; company: string;
  notTranslated: string; unavailable: string; notFound: string; back: string;
};

const en: CatalogCopy = {
  home: "Home",
  coursesTitle: "Web3 & blockchain courses", coursesIntro: "Hands-on courses that take you from fundamentals to shipping real products.", coursesEmpty: "No courses are published yet.",
  hackathonsTitle: "Hackathons", hackathonsIntro: "Build with a team, get mentored and compete for prizes.", hackathonsEmpty: "No hackathons are open right now.",
  jobsTitle: "Web3 jobs", jobsIntro: "Roles from verified partner companies, refreshed daily.", jobsEmpty: "No open roles right now.",
  viewDetails: "View details", startLearning: "Start learning", outcomes: "What you'll learn", skills: "Skills", about: "About this course",
  level: "Level", duration: "Duration", hours: "h", instructor: "Instructor",
  levels: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
  joinHackathon: "Join the hackathon", starts: "Starts", ends: "Ends", host: "Host", participants: "Participants", prizes: "Prizes",
  modes: { online: "Online", offline: "In person", hybrid: "Hybrid" },
  statuses: { published: "Upcoming", running: "Running", ended: "Ended" },
  applyNow: "Apply now", viewInApp: "Save and track in Corelia", posted: "Posted", location: "Location", remote: "Remote", salary: "Salary", company: "Company",
  notTranslated: "This content is not available in your language yet, so it is shown in its original language.",
  unavailable: "The catalog is temporarily unavailable. Please try again shortly.", notFound: "We couldn't find that page.", back: "Back",
};

const vi: CatalogCopy = {
  home: "Trang chủ",
  coursesTitle: "Khóa học Web3 & blockchain", coursesIntro: "Khóa học thực chiến đưa bạn từ nền tảng đến sản phẩm thật.", coursesEmpty: "Chưa có khóa học nào được xuất bản.",
  hackathonsTitle: "Hackathon", hackathonsIntro: "Xây dựng cùng đội, được mentor hỗ trợ và tranh tài giành giải thưởng.", hackathonsEmpty: "Hiện chưa có hackathon nào.",
  jobsTitle: "Việc làm Web3", jobsIntro: "Vị trí từ các doanh nghiệp đối tác đã xác minh, cập nhật mỗi ngày.", jobsEmpty: "Hiện chưa có vị trí nào đang tuyển.",
  viewDetails: "Xem chi tiết", startLearning: "Bắt đầu học", outcomes: "Bạn sẽ học được", skills: "Kỹ năng", about: "Giới thiệu khóa học",
  level: "Trình độ", duration: "Thời lượng", hours: "giờ", instructor: "Giảng viên",
  levels: { beginner: "Cơ bản", intermediate: "Trung cấp", advanced: "Nâng cao" },
  joinHackathon: "Tham gia hackathon", starts: "Bắt đầu", ends: "Kết thúc", host: "Đơn vị tổ chức", participants: "Người tham gia", prizes: "Giải thưởng",
  modes: { online: "Trực tuyến", offline: "Trực tiếp", hybrid: "Kết hợp" },
  statuses: { published: "Sắp diễn ra", running: "Đang diễn ra", ended: "Đã kết thúc" },
  applyNow: "Ứng tuyển ngay", viewInApp: "Lưu và theo dõi trên Corelia", posted: "Đăng ngày", location: "Địa điểm", remote: "Từ xa", salary: "Mức lương", company: "Công ty",
  notTranslated: "Nội dung này chưa có bản dịch sang ngôn ngữ của bạn nên được hiển thị bằng ngôn ngữ gốc.",
  unavailable: "Danh mục tạm thời không khả dụng. Vui lòng thử lại sau.", notFound: "Không tìm thấy trang này.", back: "Quay lại",
};

const zhCN: CatalogCopy = {
  home: "首页",
  coursesTitle: "Web3 与区块链课程", coursesIntro: "从基础到真实产品上线的实战课程。", coursesEmpty: "暂无已发布的课程。",
  hackathonsTitle: "黑客松", hackathonsIntro: "组队开发、获得导师指导并争夺奖项。", hackathonsEmpty: "目前没有开放的黑客松。",
  jobsTitle: "Web3 职位", jobsIntro: "来自已认证合作企业的职位，每日更新。", jobsEmpty: "目前没有开放的职位。",
  viewDetails: "查看详情", startLearning: "开始学习", outcomes: "你将学到", skills: "技能", about: "课程介绍",
  level: "难度", duration: "时长", hours: "小时", instructor: "讲师",
  levels: { beginner: "入门", intermediate: "中级", advanced: "高级" },
  joinHackathon: "参加黑客松", starts: "开始", ends: "结束", host: "主办方", participants: "参与者", prizes: "奖项",
  modes: { online: "线上", offline: "线下", hybrid: "线上线下结合" },
  statuses: { published: "即将开始", running: "进行中", ended: "已结束" },
  applyNow: "立即申请", viewInApp: "在 Corelia 中收藏和跟踪", posted: "发布于", location: "地点", remote: "远程", salary: "薪资", company: "公司",
  notTranslated: "此内容暂无你所选语言的版本，因此以原始语言显示。",
  unavailable: "目录暂时不可用，请稍后再试。", notFound: "找不到该页面。", back: "返回",
};

const zhTW: CatalogCopy = {
  home: "首頁",
  coursesTitle: "Web3 與區塊鏈課程", coursesIntro: "從基礎到真實產品上線的實戰課程。", coursesEmpty: "目前尚無已發布的課程。",
  hackathonsTitle: "黑客松", hackathonsIntro: "組隊開發、獲得導師指導並爭取獎項。", hackathonsEmpty: "目前沒有開放的黑客松。",
  jobsTitle: "Web3 職缺", jobsIntro: "來自已驗證合作企業的職缺，每日更新。", jobsEmpty: "目前沒有開放的職缺。",
  viewDetails: "查看詳情", startLearning: "開始學習", outcomes: "你將學到", skills: "技能", about: "課程介紹",
  level: "難度", duration: "時長", hours: "小時", instructor: "講師",
  levels: { beginner: "入門", intermediate: "中級", advanced: "進階" },
  joinHackathon: "參加黑客松", starts: "開始", ends: "結束", host: "主辦單位", participants: "參與者", prizes: "獎項",
  modes: { online: "線上", offline: "實體", hybrid: "線上與實體" },
  statuses: { published: "即將開始", running: "進行中", ended: "已結束" },
  applyNow: "立即應徵", viewInApp: "在 Corelia 收藏與追蹤", posted: "刊登於", location: "地點", remote: "遠端", salary: "薪資", company: "公司",
  notTranslated: "此內容尚無你所選語言的版本，因此以原始語言顯示。",
  unavailable: "目錄暫時無法使用，請稍後再試。", notFound: "找不到此頁面。", back: "返回",
};

const ko: CatalogCopy = {
  home: "홈",
  coursesTitle: "Web3·블록체인 강좌", coursesIntro: "기초부터 실제 제품 출시까지 이끄는 실전 강좌입니다.", coursesEmpty: "아직 공개된 강좌가 없습니다.",
  hackathonsTitle: "해커톤", hackathonsIntro: "팀과 함께 만들고, 멘토링을 받고, 상금을 겨루세요.", hackathonsEmpty: "현재 열린 해커톤이 없습니다.",
  jobsTitle: "Web3 채용", jobsIntro: "검증된 파트너사의 채용 공고를 매일 업데이트합니다.", jobsEmpty: "현재 채용 중인 포지션이 없습니다.",
  viewDetails: "자세히 보기", startLearning: "학습 시작", outcomes: "배우게 될 내용", skills: "스킬", about: "강좌 소개",
  level: "난이도", duration: "학습 시간", hours: "시간", instructor: "강사",
  levels: { beginner: "입문", intermediate: "중급", advanced: "고급" },
  joinHackathon: "해커톤 참가하기", starts: "시작", ends: "종료", host: "주최", participants: "참가자", prizes: "상금",
  modes: { online: "온라인", offline: "오프라인", hybrid: "하이브리드" },
  statuses: { published: "예정", running: "진행 중", ended: "종료" },
  applyNow: "지원하기", viewInApp: "Corelia에서 저장하고 관리하기", posted: "게시일", location: "근무지", remote: "원격", salary: "급여", company: "회사",
  notTranslated: "이 콘텐츠는 아직 선택한 언어로 번역되지 않아 원래 언어로 표시됩니다.",
  unavailable: "카탈로그를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도하세요.", notFound: "페이지를 찾을 수 없습니다.", back: "돌아가기",
};

const ja: CatalogCopy = {
  home: "ホーム",
  coursesTitle: "Web3・ブロックチェーン講座", coursesIntro: "基礎から実際のプロダクト公開まで導く実践講座です。", coursesEmpty: "公開中のコースはまだありません。",
  hackathonsTitle: "ハッカソン", hackathonsIntro: "チームで開発し、メンターの支援を受けて賞を目指しましょう。", hackathonsEmpty: "現在開催中のハッカソンはありません。",
  jobsTitle: "Web3 求人", jobsIntro: "認証済みパートナー企業の求人を毎日更新しています。", jobsEmpty: "現在募集中の求人はありません。",
  viewDetails: "詳細を見る", startLearning: "学習を始める", outcomes: "学べること", skills: "スキル", about: "コースについて",
  level: "レベル", duration: "学習時間", hours: "時間", instructor: "講師",
  levels: { beginner: "初級", intermediate: "中級", advanced: "上級" },
  joinHackathon: "ハッカソンに参加する", starts: "開始", ends: "終了", host: "主催", participants: "参加者", prizes: "賞",
  modes: { online: "オンライン", offline: "対面", hybrid: "ハイブリッド" },
  statuses: { published: "開催予定", running: "開催中", ended: "終了" },
  applyNow: "応募する", viewInApp: "Corelia で保存・管理する", posted: "掲載日", location: "勤務地", remote: "リモート", salary: "給与", company: "会社",
  notTranslated: "このコンテンツは選択した言語にまだ翻訳されていないため、元の言語で表示しています。",
  unavailable: "カタログは一時的に利用できません。しばらくしてから再度お試しください。", notFound: "ページが見つかりません。", back: "戻る",
};

const es: CatalogCopy = {
  home: "Inicio",
  coursesTitle: "Cursos de Web3 y blockchain", coursesIntro: "Cursos prácticos que te llevan de los fundamentos a lanzar productos reales.", coursesEmpty: "Todavía no hay cursos publicados.",
  hackathonsTitle: "Hackathons", hackathonsIntro: "Construye en equipo, recibe mentoría y compite por premios.", hackathonsEmpty: "No hay hackathons abiertos en este momento.",
  jobsTitle: "Empleos Web3", jobsIntro: "Vacantes de empresas aliadas verificadas, actualizadas cada día.", jobsEmpty: "No hay vacantes abiertas en este momento.",
  viewDetails: "Ver detalles", startLearning: "Empezar a aprender", outcomes: "Lo que aprenderás", skills: "Habilidades", about: "Sobre este curso",
  level: "Nivel", duration: "Duración", hours: "h", instructor: "Instructor",
  levels: { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" },
  joinHackathon: "Unirse al hackathon", starts: "Inicio", ends: "Fin", host: "Organiza", participants: "Participantes", prizes: "Premios",
  modes: { online: "En línea", offline: "Presencial", hybrid: "Híbrido" },
  statuses: { published: "Próximamente", running: "En curso", ended: "Finalizado" },
  applyNow: "Postularme", viewInApp: "Guárdalo y haz seguimiento en Corelia", posted: "Publicado", location: "Ubicación", remote: "Remoto", salary: "Salario", company: "Empresa",
  notTranslated: "Este contenido aún no está disponible en tu idioma, así que se muestra en su idioma original.",
  unavailable: "El catálogo no está disponible temporalmente. Inténtalo de nuevo en unos minutos.", notFound: "No encontramos esa página.", back: "Volver",
};

export const CATALOG_COPY: Record<SiteLocale, CatalogCopy> = { en, vi, "zh-CN": zhCN, "zh-TW": zhTW, ko, ja, es };
