import { EMAIL_BRAND } from "./brand.ts";
import { escapeHtml } from "../html.ts";
import { emailCtaButton, wrapTransactionalEmail, type EmailLocale } from "./layout.ts";

type StageCopy = {
  tag: string;
  title: (courseTitle: string) => string;
  sub: (escapedName: string) => string;
  body: (courseCount: number) => string;
};
type ReminderCopy = {
  stages: Record<3 | 7 | 14 | 30, StageCopy>;
  courseList: string;
  cta: string;
  reason: string;
};

const COPY: Record<EmailLocale, ReminderCopy> = {
  en: {
    stages: {
      3: { tag: "LEARNING REMINDER", title: (c) => `Keep up with "${c}"`, sub: (n) => `Hi ${n}, take 10 minutes today to maintain your momentum.`, body: () => `<p>Consistent practice is the key to mastering new skills. Jump back into your lesson to stay on track.</p>` },
      7: { tag: "WEEKLY CHECK-IN", title: (_c) => "It's been a week since your last lesson", sub: (n) => `Hi ${n}, let's keep your progress going strong.`, body: (k) => `<p>You have ${k} in-progress course(s). Resume now to make meaningful progress this week.</p>` },
      14: { tag: "LEARNING COMMUNITY", title: (_c) => "Pick up where you left off", sub: (n) => `Hi ${n}, your next milestones are waiting.`, body: () => `<p>Your fellow learners are progressing quickly and claiming course credentials. Continue your journey today!</p>` },
      30: { tag: "FINAL REMINDER", title: (_c) => "We're pausing learning reminders for you", sub: (n) => `Hi ${n}, we respect your inbox.`, body: () => `<p>This is the final automated reminder for your current courses. Whenever you are ready to learn again, your progress is safely saved on Corelia.</p>` },
    },
    courseList: "Your in-progress courses:",
    cta: "Resume Learning",
    reason: "You received this email because you are enrolled in courses on Corelia.",
  },
  "zh-CN": {
    stages: {
      3: { tag: "学习提醒", title: (c) => `别忘了学习“${c}”`, sub: (n) => `${n}，您好！今天只需 10 分钟，就能保持学习势头。`, body: () => `<p>持续练习是掌握新技能的关键。快回到课程中，继续您的学习吧。</p>` },
      7: { tag: "每周回顾", title: (_c) => "距离您上次学习已经一周了", sub: (n) => `${n}，您好！让我们一起保持良好的学习进度。`, body: (k) => `<p>您有 ${k} 门课程正在学习中。现在继续学习，本周就能取得实质性进展。</p>` },
      14: { tag: "学习社区", title: (_c) => "从上次中断的地方继续", sub: (n) => `${n}，您好！您的下一个里程碑正在等着您。`, body: () => `<p>其他学习者进步很快，正在陆续获得课程证书。今天就继续您的学习之旅吧！</p>` },
      30: { tag: "最后提醒", title: (_c) => "我们将暂停向您发送学习提醒", sub: (n) => `${n}，您好！我们尊重您的收件箱。`, body: () => `<p>这是针对您当前课程的最后一封自动提醒邮件。无论何时您准备好重新学习，您的进度都会安全地保存在 Corelia。</p>` },
    },
    courseList: "您正在学习的课程：",
    cta: "继续学习",
    reason: "您收到此邮件是因为您已在 Corelia 报名了课程。",
  },
  ko: {
    stages: {
      3: { tag: "학습 알림", title: (c) => `"${c}" 학습을 이어가세요`, sub: (n) => `${n}님, 안녕하세요. 오늘 10분만 투자해 학습 흐름을 이어가세요.`, body: () => `<p>꾸준한 연습이 새로운 기술을 익히는 열쇠입니다. 강의로 돌아와 학습을 계속해 보세요.</p>` },
      7: { tag: "주간 점검", title: (_c) => "마지막 학습 이후 일주일이 지났어요", sub: (n) => `${n}님, 안녕하세요. 학습 진도를 계속 이어가 봐요.`, body: (k) => `<p>현재 수강 중인 강의가 ${k}개 있습니다. 지금 이어서 학습하고 이번 주에 의미 있는 진전을 이뤄 보세요.</p>` },
      14: { tag: "학습 커뮤니티", title: (_c) => "멈췄던 곳에서 다시 시작하세요", sub: (n) => `${n}님, 안녕하세요. 다음 목표가 기다리고 있어요.`, body: () => `<p>다른 학습자들이 빠르게 진도를 나가며 수료 인증서를 받고 있습니다. 오늘 학습 여정을 이어가세요!</p>` },
      30: { tag: "마지막 알림", title: (_c) => "학습 알림 발송을 잠시 중단합니다", sub: (n) => `${n}님, 안녕하세요. 받은편지함을 소중히 여깁니다.`, body: () => `<p>수강 중인 강의에 대한 마지막 자동 알림입니다. 언제든 다시 학습할 준비가 되시면, 진행 상황은 Corelia에 안전하게 저장되어 있습니다.</p>` },
    },
    courseList: "수강 중인 강의:",
    cta: "학습 이어가기",
    reason: "Corelia에서 강의에 등록하셨기 때문에 이 이메일을 받으셨습니다.",
  },
  es: {
    stages: {
      3: { tag: "RECORDATORIO DE APRENDIZAJE", title: (c) => `Sigue con "${c}"`, sub: (n) => `Hola ${n}, dedica 10 minutos hoy para mantener tu ritmo.`, body: () => `<p>La práctica constante es la clave para dominar nuevas habilidades. Vuelve a tu lección para seguir avanzando.</p>` },
      7: { tag: "REVISIÓN SEMANAL", title: (_c) => "Ha pasado una semana desde tu última lección", sub: (n) => `Hola ${n}, sigamos avanzando con fuerza.`, body: (k) => `<p>Tienes ${k} curso(s) en progreso. Retómalos ahora para lograr un avance significativo esta semana.</p>` },
      14: { tag: "COMUNIDAD DE APRENDIZAJE", title: (_c) => "Retoma donde lo dejaste", sub: (n) => `Hola ${n}, tus próximos hitos te esperan.`, body: () => `<p>Otros estudiantes avanzan rápido y obtienen credenciales de curso. ¡Continúa tu camino hoy!</p>` },
      30: { tag: "ÚLTIMO RECORDATORIO", title: (_c) => "Pausaremos tus recordatorios de aprendizaje", sub: (n) => `Hola ${n}, respetamos tu bandeja de entrada.`, body: () => `<p>Este es el último recordatorio automático sobre tus cursos actuales. Cuando quieras volver a aprender, tu progreso estará guardado de forma segura en Corelia.</p>` },
    },
    courseList: "Tus cursos en progreso:",
    cta: "Continuar aprendiendo",
    reason: "Recibes este correo porque estás inscrito en cursos en Corelia.",
  },
  "zh-TW": {
    stages: {
      3: { tag: "學習提醒", title: (c) => `別忘了學習「${c}」`, sub: (n) => `${n}，您好！今天只需 10 分鐘，就能保持學習動能。`, body: () => `<p>持續練習是掌握新技能的關鍵。快回到課程中，繼續您的學習吧。</p>` },
      7: { tag: "每週回顧", title: (_c) => "距離您上次學習已經一週了", sub: (n) => `${n}，您好！讓我們一起保持良好的學習進度。`, body: (k) => `<p>您有 ${k} 門課程正在學習中。現在繼續學習，本週就能取得實質進展。</p>` },
      14: { tag: "學習社群", title: (_c) => "從上次中斷的地方繼續", sub: (n) => `${n}，您好！您的下一個里程碑正等著您。`, body: () => `<p>其他學習者進步很快，正陸續取得課程證書。今天就繼續您的學習之旅吧！</p>` },
      30: { tag: "最後提醒", title: (_c) => "我們將暫停向您發送學習提醒", sub: (n) => `${n}，您好！我們尊重您的收件匣。`, body: () => `<p>這是針對您目前課程的最後一封自動提醒郵件。無論何時您準備好重新學習，您的進度都會安全地保存在 Corelia。</p>` },
    },
    courseList: "您正在學習的課程：",
    cta: "繼續學習",
    reason: "您收到此郵件是因為您已在 Corelia 報名了課程。",
  },
  vi: {
    stages: {
      3: { tag: "DUY TRÌ THÓI QUEN", title: (c) => `Đừng quên bài học "${c}"`, sub: (n) => `Chào ${n}, chỉ cần 10 phút hôm nay để giữ vững đà tiến bộ.`, body: () => `<p>Kiến thức sẽ dễ ghi nhớ nhất khi bạn ôn tập đều đặn. Hãy tiếp tục nội dung đang học để không bị gián đoạn mục tiêu.</p>` },
      7: { tag: "MỤC TIÊU TUẦN", title: (_c) => "Đã 1 tuần trôi qua kể từ bài học gần nhất", sub: (n) => `Chào ${n}, cùng kiểm tra lại tiến độ khóa học nhé.`, body: (k) => `<p>Bạn đang có ${k} khóa học đang tiến hành. Dành ra một khoảng thời gian ngắn để hoàn thành chương tiếp theo và mở khóa các kỹ năng mới.</p>` },
      14: { tag: "CỘNG ĐỒNG HỌC TẬP", title: (_c) => "Các bạn cùng khóa đang tiến rất nhanh", sub: (n) => `Chào ${n}, quay lại và hoàn tất mục tiêu nhé.`, body: () => `<p>Rất nhiều học viên vừa mở khóa chứng chỉ và huy hiệu kỹ năng mới. Hãy quay lại tiếp tục bài học của bạn ngay hôm nay!</p>` },
      30: { tag: "THÔNG BÁO CUỐI CÙNG", title: (_c) => "Chúng tôi sẽ tạm dừng gửi email nhắc học", sub: (n) => `Chào ${n}, chúng tôi tôn trọng hòm thư của bạn.`, body: () => `<p>Đây là email nhắc học cuối cùng cho các khóa học đang dở của bạn. Bất cứ khi nào bạn sẵn sàng, toàn bộ tiến độ và bài học vẫn luôn được lưu giữ an toàn tại Corelia.</p>` },
    },
    courseList: "Các khóa học đang học:",
    cta: "Tiếp tục học ngay",
    reason: "Bạn nhận được email này vì bạn đang ghi danh vào các khóa học trên Corelia.",
  },
  ja: {
    stages: {
      3: { tag: "学習リマインダー", title: (c) => `「${c}」の学習を続けましょう`, sub: (n) => `${n} さん、こんにちは。今日は 10 分だけ、学習のペースを保ちましょう。`, body: () => `<p>継続的な練習が新しいスキル習得の鍵です。レッスンに戻って学習を続けましょう。</p>` },
      7: { tag: "週次チェックイン", title: (_c) => "前回のレッスンから 1 週間が経ちました", sub: (n) => `${n} さん、こんにちは。学習を順調に進めましょう。`, body: (k) => `<p>受講中のコースが ${k} 件あります。今すぐ再開して、今週しっかり前進しましょう。</p>` },
      14: { tag: "学習コミュニティ", title: (_c) => "前回の続きから再開しましょう", sub: (n) => `${n} さん、こんにちは。次のマイルストーンが待っています。`, body: () => `<p>他の受講者は着実に進み、コース修了証を取得しています。今日から学習の旅を続けましょう！</p>` },
      30: { tag: "最終リマインダー", title: (_c) => "学習リマインダーの送信を一時停止します", sub: (n) => `${n} さん、こんにちは。受信トレイを大切にします。`, body: () => `<p>現在のコースに関する最後の自動リマインダーです。学習を再開したいときは、進捗が Corelia に安全に保存されています。</p>` },
    },
    courseList: "受講中のコース：",
    cta: "学習を再開",
    reason: "Corelia でコースに登録されているため、このメールをお送りしています。",
  },
};

export function buildLearningReminderEmail({ courses, displayName, locale, stage, appUrl }: {
  courses: Array<{ slug: string; title: string }>;
  displayName: string;
  locale: EmailLocale;
  stage: 3 | 7 | 14 | 30;
  appUrl: string;
}): { subject: string; html: string } {
  if (!courses.length) throw new Error("learning_reminder_requires_course");
  const primaryCourse = courses[0];
  const primaryLink = `${appUrl}/learn/${encodeURIComponent(primaryCourse.slug)}`;
  const copy = COPY[locale] ?? COPY.en;
  const stageCopy = copy.stages[stage];
  const heroTag = stageCopy.tag;
  const heroTitle = stageCopy.title(primaryCourse.title);
  const heroSubtitle = stageCopy.sub(escapeHtml(displayName));
  const bodyText = stageCopy.body(courses.length);

  // Course list HTML for multi-course digest
  let courseListHtml = "";
  if (courses.length > 1) {
    courseListHtml = `
      <div style="margin: 16px 0; padding: 12px; background: ${EMAIL_BRAND.surface}; border-radius: 8px; border: 1px solid ${EMAIL_BRAND.border};">
        <p style="font-size: 12px; font-weight: bold; color: ${EMAIL_BRAND.muted}; margin-bottom: 8px;">
          ${copy.courseList}
        </p>
        <ul style="padding-left: 18px; margin: 0; font-size: 13px; color: ${EMAIL_BRAND.text};">
          ${courses.map((c) => `<li><a href="${escapeHtml(`${appUrl}/learn/${encodeURIComponent(c.slug)}`)}" style="color: ${EMAIL_BRAND.link}; text-decoration: none;">${escapeHtml(c.title)}</a></li>`).join("")}
        </ul>
      </div>
    `;
  }

  const emailHtml = wrapTransactionalEmail({
    locale,
    heroTag,
    heroTitle,
    heroSubtitle,
    bodyHtml: `${bodyText}${courseListHtml}`,
    ctaHtml: emailCtaButton(primaryLink, copy.cta),
    footerReason: copy.reason,
  });

  const subject = `[Corelia] ${heroTitle}`;
  return { subject, html: emailHtml };
}
