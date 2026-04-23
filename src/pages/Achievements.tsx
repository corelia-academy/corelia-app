import { useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  Medal,
  Copy,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  Star,
  Trophy,
  AlertTriangle,
  GraduationCap,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { getCourse, getMyEnrollments } from "@/lib/courses";
import type { Enrollment } from "@/types/courses";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";

// ── Types ──────────────────────────────────────────────────────────────────────
type ClaimStatus = "unclaimed" | "pending" | "claimed" | "failed";

type CertificateItem = {
  id: string;
  title: string;
  course: string;
  issuedAt: string;
  instructor: string;
  type: "online" | "offline";
  credentialId: string;
  /** Ảnh chứng chỉ (placeholder nếu chưa có) */
  imageUrl?: string;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocTransactionHash?: string;
  ocCredentialUrl?: string;
  ocHolderOcId?: string;
};

type BadgeItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  earnedAt: string | null;
  locked: boolean;
  category: "learning" | "streak" | "milestone" | "social";
  /** Ảnh huy hiệu (placeholder nếu chưa có) */
  imageUrl?: string;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocTransactionHash?: string;
  ocCredentialUrl?: string;
};

// ── Mock Data ──────────────────────────────────────────────────────────────────
const CERT_PLACEHOLDER = "https://placehold.co/400x280/1e3a5f/fff?text=Ch%E1%BB%A9ng+ch%E1%BB%89";
const BADGE_PLACEHOLDER = "https://placehold.co/160x160/2d1b4e/fff?text=Huy+hi%E1%BB%87u";

const BADGE_STYLES: Array<Pick<BadgeItem, "icon" | "color" | "bgColor" | "borderColor" | "category">> = [
  {
    icon: <Trophy className="size-7" aria-hidden />,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
    category: "milestone",
  },
  {
    icon: <Star className="size-7" aria-hidden />,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    category: "learning",
  },
  {
    icon: <Medal className="size-7" aria-hidden />,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-50 dark:bg-sky-950/50",
    borderColor: "border-sky-200 dark:border-sky-700/50",
    category: "learning",
  },
  {
    icon: <GraduationCap className="size-7" aria-hidden />,
    color: "text-on-primary-container dark:text-primary",
    bgColor: "bg-primary-container",
    borderColor: "border-primary/20",
    category: "milestone",
  },
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(intlLocale());
}

function pickCertificateType(courseOwnerType?: string | null): CertificateItem["type"] {
  return courseOwnerType === "external_partner" ? "offline" : "online";
}

function buildCredentialId(prefix: string, seed: string): string {
  return `${prefix}-${seed.slice(0, 8).toUpperCase()}`;
}

function buildCourseCertificates(
  enrollments: Enrollment[],
  courseMap: Map<string, Awaited<ReturnType<typeof getCourse>>>,
  labels: {
    courseCompletionTitle: string;
    fallbackCourseName: string;
    fallbackInstructorName: string;
  },
): CertificateItem[] {
  return enrollments
    .filter((item) => !!item.certificate_issued_at)
    .map((item) => {
      const course = courseMap.get(item.course_id);
      return {
        id: `course-cert-${item.id}`,
        title: labels.courseCompletionTitle,
        course: course?.title || labels.fallbackCourseName,
        issuedAt: formatDate(item.certificate_issued_at),
        instructor: course?.instructor_name || labels.fallbackInstructorName,
        type: pickCertificateType(course?.owner_type),
        credentialId: buildCredentialId("COURSE", item.id),
        imageUrl: course?.certificate_template_url || CERT_PLACEHOLDER,
        ocClaimStatus: "unclaimed",
      } satisfies CertificateItem;
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

function buildMilestoneBadges(
  enrollments: Enrollment[],
  labels: {
    milestones: {
      courseFirst: { title: string; description: string };
      courseThree: { title: string; description: string };
      firstCertificate: { title: string; description: string };
      threeCertificates: { title: string; description: string };
    };
  },
): BadgeItem[] {
  const enrolledCourses = enrollments.length;
  const courseCertificates = enrollments.filter((item) => !!item.certificate_issued_at).length;
  const milestones = [
    {
      id: "milestone-course-first",
      title: labels.milestones.courseFirst.title,
      description: labels.milestones.courseFirst.description,
      thresholdMet: enrolledCourses >= 1,
      earnedAt: enrollments[0]?.enrolled_at ?? null,
      style: BADGE_STYLES[0],
      category: "milestone" as const,
    },
    {
      id: "milestone-course-three",
      title: labels.milestones.courseThree.title,
      description: labels.milestones.courseThree.description,
      thresholdMet: enrolledCourses >= 3,
      earnedAt: null,
      style: BADGE_STYLES[1],
      category: "learning" as const,
    },
    {
      id: "milestone-course-first-cert",
      title: labels.milestones.firstCertificate.title,
      description: labels.milestones.firstCertificate.description,
      thresholdMet: courseCertificates >= 1,
      earnedAt:
        enrollments.find((item) => item.certificate_issued_at)?.certificate_issued_at ?? null,
      style: BADGE_STYLES[2],
      category: "milestone" as const,
    },
    {
      id: "milestone-course-three-certs",
      title: labels.milestones.threeCertificates.title,
      description: labels.milestones.threeCertificates.description,
      thresholdMet: courseCertificates >= 3,
      earnedAt: null,
      style: BADGE_STYLES[3],
      category: "learning" as const,
    },
  ];

  return milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    icon: milestone.style.icon,
    imageUrl: BADGE_PLACEHOLDER,
    color: milestone.style.color,
    bgColor: milestone.style.bgColor,
    borderColor: milestone.style.borderColor,
    earnedAt: milestone.thresholdMet ? formatDate(milestone.earnedAt) : null,
    locked: !milestone.thresholdMet,
    category: milestone.category,
    ocClaimStatus: "unclaimed",
  }));
}

// ── OpenCampus Claim Status Badge ─────────────────────────────────────────────
function OcClaimBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation("common");
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold sm:text-sm";
  if (status === "claimed") {
    return (
      <span className={cn(base, "bg-success/15 text-success")}>
        <BadgeCheck className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        {t("achievements.oc.badge.claimed")}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className={cn(base, "bg-warning/15 text-warning")}>
        <Loader2 className="size-3.5 shrink-0 animate-spin sm:size-4" aria-hidden />
        {t("achievements.oc.badge.pending")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(base, "bg-destructive/15 text-destructive")}>
        <AlertTriangle className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        {t("achievements.oc.badge.failed")}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-muted font-medium text-muted-foreground")}>
      <img src="/open-campus-edu-logo.png" alt="OC" className="size-3.5 shrink-0 rounded-full sm:size-4" />
      {t("achievements.oc.badge.unclaimed")}
    </span>
  );
}

// ── OpenCampus Credential Detail Modal ────────────────────────────────────────
type ModalItem =
  | { kind: "cert"; data: CertificateItem }
  | { kind: "badge"; data: BadgeItem };

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      title={t("actions.copy")}
    >
      {copied ? (
        <Check className="size-3.5 text-success" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </Button>
  );
}

function OcCredentialModal({
  item,
  open,
  onOpenChange,
  onClaim,
  claiming,
}: {
  item: ModalItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClaim: (id: string, kind: "cert" | "badge") => void;
  claiming: boolean;
}) {
  const { t } = useTranslation("common");
  if (!item) return null;

  const d = item.data;
  const isClaimed = d.ocClaimStatus === "claimed";
  const isPending = d.ocClaimStatus === "pending";
  const isFailed = d.ocClaimStatus === "failed";
  const isUnclaimed = d.ocClaimStatus === "unclaimed";

  const name = item.kind === "cert" ? item.data.course : item.data.title;
  const issued =
    item.kind === "cert"
      ? item.data.issuedAt
      : (item.data as BadgeItem).earnedAt ?? "—";
  const credId =
    item.kind === "cert" ? item.data.credentialId : `CRL-BADGE-${item.data.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full min-w-0 rounded-lg p-0 overflow-hidden">
        {/* Gradient header strip */}
        <div className="h-1.5 w-full bg-linear-to-r from-[#00e5b4] via-[#0047ff] to-[#00e5b4]" />

        <div className="min-w-0 p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-start gap-3">
              {/* OC Logo */}
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted border border-border-subtle sm:size-14">
                  <img
                    src={item.data.imageUrl || (item.kind === 'cert' ? CERT_PLACEHOLDER : BADGE_PLACEHOLDER)}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-snug sm:text-lg">
                  {t("achievements.oc.modal.title")}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm sm:text-base">
                  {t("achievements.oc.modal.subtitle")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Credential info */}
          <div className="mb-4 space-y-3 rounded-md border border-border-subtle bg-muted/40 p-3 sm:p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-sm">
                {item.kind === "cert"
                  ? t("achievements.oc.modal.kind.cert")
                  : t("achievements.oc.modal.kind.badge")}
              </p>
              <p className="mt-0.5 text-base font-semibold text-foreground sm:text-lg">{name}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {item.kind === "cert"
                    ? t("achievements.oc.modal.date.issued")
                    : t("achievements.oc.modal.date.earned")}
                </p>
                <p className="font-medium">{issued}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground sm:text-sm">Credential ID</p>
                <p className="font-mono text-xs font-medium truncate sm:text-sm">{credId}</p>
              </div>
            </div>

            {/* Claim status */}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t("achievements.oc.modal.statusLabel")}
              </p>
              <OcClaimBadge status={d.ocClaimStatus} />
            </div>

            {/* Claimed details */}
            {isClaimed && d.ocTransactionHash && (
              <div className="space-y-2 border-t border-border pt-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground sm:text-sm">
                    Transaction Hash
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground sm:text-sm">
                      {d.ocTransactionHash}
                    </p>
                    <CopyButton text={d.ocTransactionHash} />
                    <a
                      href={`https://opencampus-codex.blockscout.com/tx/${d.ocTransactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title={t("achievements.oc.modal.explorerTooltip")}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  </div>
                </div>
                {(d as CertificateItem).ocHolderOcId && (
                  <div>
                    <p className="text-xs text-muted-foreground">OCID</p>
                    <p className="text-sm font-medium text-foreground">
                      {(d as CertificateItem).ocHolderOcId}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OC Dashboard link + standards note */}
          {isClaimed && d.ocCredentialUrl && (
            <a
              href={d.ocCredentialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex min-w-0 items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 transition hover:bg-primary/10"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img
                  src="/open-campus-edu-logo.png"
                  alt="OC"
                  className="size-5 shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {t("achievements.oc.modal.dashboardCtaTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {t("achievements.oc.modal.dashboardCtaSubtitle")}
                  </p>
                </div>
              </div>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </a>
          )}

          {/* Standards note */}
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("achievements.oc.modal.standardsNote")}
          </p>

          <div className="flex flex-col gap-3 mt-2">
            {/* Unclaimed / Failed → show claim button */}
            {(isUnclaimed || isFailed) && (
              <Button
                className="w-full gap-3 text-base font-semibold"
                size="lg"
                disabled={claiming}
                onClick={() => onClaim(d.id, item.kind)}
              >
                {claiming ? (
                  <>
                    <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
                    <span>{t("achievements.oc.modal.claim.issuing")}</span>
                  </>
                ) : (
                  <>
                    <img
                      src="/open-campus-edu-logo.png"
                      alt=""
                      className="size-5 shrink-0 rounded-full brightness-0 invert"
                    />
                    <span>
                      {isFailed
                        ? t("achievements.oc.modal.claim.retry")
                        : t("achievements.oc.modal.claim.issue")}
                    </span>
                  </>
                )}
              </Button>
            )}

            {/* Pending */}
            {isPending && (
              <Button disabled className="w-full gap-3 text-base" size="lg">
                <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
                <span>{t("achievements.oc.modal.claim.pending")}</span>
              </Button>
            )}

            {/* Claimed actions */}
            {isClaimed && (
              <div className="flex w-full gap-3">
                <Button variant="outline" className="flex-1 gap-2 text-sm sm:text-base" size="lg">
                  <Download className="size-4 shrink-0" aria-hidden />
                  <span>{t("achievements.oc.modal.claimedActions.downloadPdf")}</span>
                </Button>
                <Button variant="outline" className="flex-1 gap-2 text-sm sm:text-base" size="lg">
                  <Share2 className="size-4 shrink-0" aria-hidden />
                  <span>{t("actions.share")}</span>
                </Button>
              </div>
            )}

            <a
              href="https://devdocs.educhain.xyz/start-building/open-campus-achievements-badges/introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t("achievements.oc.modal.learnMore")}
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────
function StatsBar({
  certificates,
  badges,
}: {
  certificates: CertificateItem[];
  badges: BadgeItem[];
}) {
  const { t } = useTranslation("common");
  const earnedBadges = badges.filter((b) => !b.locked).length;
  const claimedOc = [
    ...certificates.filter((c) => c.ocClaimStatus === "claimed"),
    ...badges.filter((b) => !b.locked && b.ocClaimStatus === "claimed"),
  ].length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {[
        {
          label: t("achievements.stats.certificates"),
          value: certificates.length,
          icon: <Award className="size-5 text-muted-foreground" aria-hidden />,
        },
        {
          label: t("achievements.stats.badges"),
          value: `${earnedBadges}/${badges.length}`,
          icon: <Medal className="size-5 text-warning" aria-hidden />,
        },
        {
          label: t("achievements.stats.total"),
          value: certificates.length + earnedBadges,
          icon: <Trophy className="size-5 text-primary" aria-hidden />,
        },
        {
          label: t("achievements.stats.ocCredential"),
          value: claimedOc,
          icon: (
            <img
              src="/open-campus-edu-logo.png"
              alt="OC"
              className="size-5 rounded-full"
            />
          ),
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-2 rounded-md border border-border-subtle bg-card p-3 shadow-card sm:flex-row sm:gap-3 sm:p-4"
        >
          <div className="shrink-0 rounded-md bg-muted/50 p-2">{stat.icon}</div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xl font-medium tabular-nums leading-none text-foreground sm:text-2xl">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stat.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Certificate Card ───────────────────────────────────────────────────────────
function CertificateCard({
  cert,
  onOpenModal,
}: {
  cert: CertificateItem;
  onOpenModal: (item: ModalItem) => void;
}) {
  const { t } = useTranslation("common");
  const imageUrl = cert.imageUrl ?? CERT_PLACEHOLDER;
  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-md border border-border-subtle bg-card shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {/* Gradient top strip */}
      <div
        className={cn(
          "h-1.5 w-full shrink-0",
          cert.type === "online"
            ? "bg-linear-to-r from-primary/80 via-primary to-primary/60"
            : "bg-linear-to-r from-on-primary-container/80 via-on-primary-container to-primary/70",
        )}
      />

      {/* Ảnh chứng chỉ (placeholder) */}
      <div className="relative h-32 w-full shrink-0 overflow-hidden bg-muted/50 sm:h-36">
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover transition-opacity duration-200 group-hover:opacity-95"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md sm:size-10",
                cert.type === "online"
                  ? "bg-primary/10 text-primary"
                  : "bg-primary-container text-on-primary-container dark:text-primary",
              )}
            >
              <Award className="size-4 sm:size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                  cert.type === "online"
                    ? "bg-primary/10 text-primary"
                    : "bg-primary-container text-on-primary-container dark:text-primary",
                )}
              >
                {cert.type === "online"
                  ? t("achievements.certificates.type.online")
                  : t("achievements.certificates.type.offline")}
              </span>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {cert.title}
              </p>
            </div>
          </div>
          <BadgeCheck className="size-4 shrink-0 text-success sm:size-5" aria-hidden />
        </div>

        {/* Course name */}
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
          {cert.course}
        </h3>

        {/* Meta */}
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{cert.instructor}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0" aria-hidden />
            <span>{t("achievements.certificates.issuedOnPrefix", { date: cert.issuedAt })}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
            <span className="truncate font-mono text-xs">{cert.credentialId}</span>
          </div>
        </div>

        {/* OC Claim Status */}
        <div className="mt-2">
          <OcClaimBadge status={cert.ocClaimStatus} />
        </div>

        {/* Actions — tránh tràn: flex-wrap, min-w-0 */}
        <div className="mt-3 flex min-w-0 flex-wrap items-stretch gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenModal({ kind: "cert", data: cert })}
            className={cn(
              cert.ocClaimStatus === "claimed"
                ? "border-success/20 bg-success/10 text-success hover:bg-success/15"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <img
              src="/open-campus-edu-logo.png"
              alt="OC"
              className="size-3.5 shrink-0 rounded-full sm:size-4"
            />
            <span className="truncate">
              {cert.ocClaimStatus === "claimed"
                ? t("achievements.certificates.ocAction.view")
                : t("achievements.certificates.ocAction.claim")}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            title={t("actions.download")}
          >
            <Download className="size-4 shrink-0" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Badge Card ─────────────────────────────────────────────────────────────────
function BadgeCard({
  badge,
  onOpenModal,
}: {
  badge: BadgeItem;
  onOpenModal: (item: ModalItem) => void;
}) {
  const { t } = useTranslation("common");
  const imageUrl = badge.imageUrl ?? BADGE_PLACEHOLDER;
  return (
    <div
      className={cn(
        "group relative flex min-w-0 flex-col items-center gap-2 rounded-md border p-3 text-center transition-all duration-200 sm:gap-3 sm:p-4",
        badge.locked
          ? "border-border bg-muted/30 opacity-60 grayscale"
          : cn(
              badge.bgColor,
              badge.borderColor,
              "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
            ),
      )}
      onClick={() => !badge.locked && onOpenModal({ kind: "badge", data: badge })}
    >
      {/* Lock overlay */}
      {badge.locked && (
        <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
          <Lock className="size-4 text-muted-foreground sm:size-5" />
        </div>
      )}

      {/* OC status dot (top-left for earned) */}
      {!badge.locked && (
        <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
          {badge.ocClaimStatus === "claimed" ? (
            <span title={t("achievements.badges.ocDot.claimedTooltip")}>
              <BadgeCheck className="size-4 text-success sm:size-5" aria-hidden />
            </span>
          ) : (
            <span title={t("achievements.badges.ocDot.unclaimedTooltip")}>
              <img
                src="/open-campus-edu-logo.png"
                alt="OC"
                className="size-4 rounded-full opacity-50 sm:size-5"
              />
            </span>
          )}
        </div>
      )}

      {/* Ảnh huy hiệu (placeholder nếu chưa có) */}
      <div
        className={cn(
          "relative size-14 overflow-hidden rounded-md border-2 sm:size-20",
          badge.locked
            ? "border-border bg-muted"
            : cn("border-2", badge.borderColor, badge.bgColor),
        )}
      >
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "size-full object-cover transition-opacity duration-200 group-hover:opacity-95",
            badge.locked && "opacity-60",
          )}
        />
        {badge.locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            {badge.icon}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 space-y-0.5">
        <p
          className={cn(
            "text-xs font-semibold sm:text-sm",
            badge.locked ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {badge.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {badge.description}
        </p>
        {!badge.locked && badge.earnedAt && (
          <p className={cn("text-xs font-medium", badge.color)}>
            {t("achievements.badges.earnedPrefix", { date: badge.earnedAt })}
          </p>
        )}
        {badge.locked && (
          <span className="inline-block rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {t("achievements.badges.locked")}
          </span>
        )}
      </div>

      {/* Bottom row: category + oc status */}
      {!badge.locked && (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-between">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              badge.color,
              badge.bgColor,
            )}
          >
            {t(`achievements.badgeCategory.${badge.category}` as never)}
          </span>
          <OcClaimBadge status={badge.ocClaimStatus} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Achievements() {
  const { user, isAuthenticated } = useAuth();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation("common");

  useEffect(() => {
    let cancelled = false;

    async function loadAchievements() {
      if (!user || !isAuthenticated) {
        if (!cancelled) {
          setCertificates([]);
          setBadges(
            buildMilestoneBadges([], {
              milestones: {
                courseFirst: {
                  title: t("achievements.milestones.courseFirst.title"),
                  description: t("achievements.milestones.courseFirst.description"),
                },
                courseThree: {
                  title: t("achievements.milestones.courseThree.title"),
                  description: t("achievements.milestones.courseThree.description"),
                },
                firstCertificate: {
                  title: t("achievements.milestones.firstCertificate.title"),
                  description: t("achievements.milestones.firstCertificate.description"),
                },
                threeCertificates: {
                  title: t("achievements.milestones.threeCertificates.title"),
                  description: t("achievements.milestones.threeCertificates.description"),
                },
              },
            }),
          );
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const enrollments = await getMyEnrollments(user.uid).catch(
          () => [] as Enrollment[],
        );

        const courseIds = Array.from(new Set(enrollments.map((item) => item.course_id)));

        const courseRows = await Promise.all(
          courseIds.map(async (courseId) => [courseId, await getCourse(courseId)] as const),
        );

        if (cancelled) return;

        const courseMap = new Map(courseRows);
        const nextCertificates = buildCourseCertificates(enrollments, courseMap, {
          courseCompletionTitle: t("achievements.certificates.courseCompletionTitle"),
          fallbackCourseName: t("achievements.certificates.fallbackCourseName"),
          fallbackInstructorName: t("achievements.certificates.fallbackInstructorName"),
        }).sort((a, b) => {
          const aDate = a.issuedAt.split("/").reverse().join("-");
          const bDate = b.issuedAt.split("/").reverse().join("-");
          return bDate.localeCompare(aDate);
        });
        const nextBadges = buildMilestoneBadges(enrollments, {
          milestones: {
            courseFirst: {
              title: t("achievements.milestones.courseFirst.title"),
              description: t("achievements.milestones.courseFirst.description"),
            },
            courseThree: {
              title: t("achievements.milestones.courseThree.title"),
              description: t("achievements.milestones.courseThree.description"),
            },
            firstCertificate: {
              title: t("achievements.milestones.firstCertificate.title"),
              description: t("achievements.milestones.firstCertificate.description"),
            },
            threeCertificates: {
              title: t("achievements.milestones.threeCertificates.title"),
              description: t("achievements.milestones.threeCertificates.description"),
            },
          },
        });

        setCertificates(nextCertificates);
        setBadges(nextBadges);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAchievements();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, t, user]);

  const openModal = (item: ModalItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const handleClaim = async (id: string, kind: "cert" | "badge") => {
    setClaiming(true);

    const setPending = (status: ClaimStatus) => {
      if (kind === "cert") {
        setCertificates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ocClaimStatus: status } : c)),
        );
        setModalItem((prev) =>
          prev?.kind === "cert" && prev.data.id === id
            ? { kind: "cert", data: { ...prev.data, ocClaimStatus: status } }
            : prev,
        );
      } else {
        setBadges((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ocClaimStatus: status } : b)),
        );
        setModalItem((prev) =>
          prev?.kind === "badge" && prev.data.id === id
            ? { kind: "badge", data: { ...prev.data, ocClaimStatus: status } }
            : prev,
        );
      }
    };

    setPending("pending");
    await new Promise((res) => setTimeout(res, 2500));

    const mockTxHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")}`;
    const mockOcUrl =
      "https://id.opencampus.xyz/public/credentials?username=student.edu";

    if (kind === "cert") {
      setCertificates((prev) => {
        const next = prev.map((c) =>
          c.id === id
            ? {
                ...c,
                ocClaimStatus: "claimed" as ClaimStatus,
                ocTransactionHash: mockTxHash,
                ocCredentialUrl: mockOcUrl,
                ocHolderOcId: "student.edu",
              }
            : c,
        );
        const updated = next.find((c) => c.id === id);
        if (updated) setModalItem({ kind: "cert", data: updated });
        return next;
      });
    } else {
      setBadges((prev) => {
        const next = prev.map((b) =>
          b.id === id
            ? {
                ...b,
                ocClaimStatus: "claimed" as ClaimStatus,
                ocTransactionHash: mockTxHash,
                ocCredentialUrl: mockOcUrl,
              }
            : b,
        );
        const updated = next.find((b) => b.id === id);
        if (updated) setModalItem({ kind: "badge", data: updated });
        return next;
      });
    }

    setClaiming(false);
  };

  const earnedBadges = badges.filter((b) => !b.locked);
  const lockedBadges = badges.filter((b) => b.locked);
  const claimedCount = [
    ...certificates.filter((c) => c.ocClaimStatus === "claimed"),
    ...earnedBadges.filter((b) => b.ocClaimStatus === "claimed"),
  ].length;
  const pendingCount = [
    ...certificates.filter((c) => c.ocClaimStatus === "pending"),
    ...earnedBadges.filter((b) => b.ocClaimStatus === "pending"),
  ].length;
  const unclaimedCount = [
    ...certificates.filter((c) => c.ocClaimStatus === "unclaimed"),
    ...earnedBadges.filter((b) => b.ocClaimStatus === "unclaimed"),
  ].length;
  const recentCertificates = certificates.slice(0, 3);
  const recentBadges = earnedBadges.slice(0, 4);
  const nextMilestones = lockedBadges.slice(0, 3);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="mb-6 overflow-hidden rounded-lg border border-border-subtle bg-card shadow-card">
        <div className="relative p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_oklch,var(--primary-container)_58%,transparent),transparent_72%)]" />
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                {t("achievements.hero.eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
                {t("achievements.hero.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {t("achievements.hero.subtitlePrefix")}{" "}
                <a
                  href="https://opencampus.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Open Campus
                </a>{" "}
                {t("achievements.hero.subtitleSuffix")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-border-subtle bg-background/85 px-3 py-2 text-sm text-foreground">
                  {t("achievements.hero.certCount", { count: certificates.length })}
                </div>
                <div className="rounded-full border border-border-subtle bg-background/85 px-3 py-2 text-sm text-foreground">
                  {t("achievements.hero.badgeUnlockedCount", { count: earnedBadges.length })}
                </div>
                <div className="rounded-full border border-border-subtle bg-background/85 px-3 py-2 text-sm text-foreground">
                  {t("achievements.hero.readyToClaimCount", { count: unclaimedCount })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border-subtle bg-background/85 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {t("achievements.hero.claimedOnOc.title")}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{claimedCount}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("achievements.hero.claimedOnOc.description")}
                </p>
              </div>
              <div className="rounded-md border border-border-subtle bg-background/85 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {t("achievements.hero.pending.title")}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{pendingCount}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("achievements.hero.pending.description")}
                </p>
              </div>
              <div className="rounded-md border border-border-subtle bg-background/85 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {t("achievements.hero.nextMilestone")}
                </p>
                <p className="mt-2 text-lg font-medium text-foreground">
                  {nextMilestones[0]?.title ?? t("achievements.milestones.next.titleFallback")}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {nextMilestones[0]?.description ??
                    t("achievements.milestones.next.descriptionFallback")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <StatsBar certificates={certificates} badges={badges} />
      </div>

      <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("achievements.meaning.title")}
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              {t("achievements.meaning.p1")}
            </p>
            <p>
              {t("achievements.meaning.p2")}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("achievements.useCases.title")}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span
                key={idx}
                className="rounded-full border border-border-subtle bg-background px-3 py-2 text-sm text-foreground"
              >
                {t(`achievements.useCases.items.${idx}` as never)}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {t("achievements.useCases.note")}
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("achievements.recent.title")}
          </div>
          {loading ? (
            <div className="mt-5 flex min-h-44 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border-subtle bg-muted/20 text-center">
              <Loader2 className="size-10 animate-spin text-muted-foreground/60" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {t("achievements.recent.loading")}
              </p>
            </div>
          ) : recentBadges.length === 0 && recentCertificates.length === 0 ? (
            <div className="mt-5 flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Trophy className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("achievements.recent.empty")}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentCertificates.map((cert) => (
                  <Button
                    key={cert.id}
                    type="button"
                    variant="ghost"
                    onClick={() => openModal({ kind: "cert", data: cert })}
                    className="h-auto w-full justify-start rounded-md border border-border-subtle bg-background p-4 text-left hover:bg-muted/40"
                  >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Award className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{cert.course}</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                      {cert.title} · {cert.issuedAt}
                    </div>
                  </div>
                  <OcClaimBadge status={cert.ocClaimStatus} />
                  </Button>
              ))}
              {recentBadges.map((badge) => (
                  <Button
                    key={badge.id}
                    type="button"
                    variant="ghost"
                    onClick={() => openModal({ kind: "badge", data: badge })}
                    className="h-auto w-full justify-start rounded-md border border-border-subtle bg-background p-4 text-left hover:bg-muted/40"
                  >
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-md",
                      badge.bgColor,
                      badge.color,
                    )}
                  >
                    {badge.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{badge.title}</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                      {badge.description}
                    </div>
                  </div>
                  <OcClaimBadge status={badge.ocClaimStatus} />
                  </Button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <Lock className="size-4" aria-hidden />
            Sắp mở khóa
          </div>
          <div className="mt-5 space-y-3">
            {nextMilestones.length > 0 ? (
              nextMilestones.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-md border border-border-subtle bg-muted/20 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                      {badge.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{badge.title}</div>
                      <div className="mt-1 text-sm leading-6 text-muted-foreground">
                        {badge.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-border-subtle bg-background p-4 text-sm leading-6 text-muted-foreground">
                {t("achievements.vaults.nextUnlock.allUnlockedNote")}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t("achievements.vaults.certificates.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("achievements.vaults.certificates.subtitle")}
            </p>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {t("achievements.vaults.certificates.countLabel", { count: certificates.length })}
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("achievements.vaults.certificates.loading")}
              </p>
            </div>
          </div>
        ) : certificates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Award className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("achievements.vaults.certificates.empty")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <CertificateCard key={cert.id} cert={cert} onOpenModal={openModal} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t("achievements.vaults.badges.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("achievements.vaults.badges.subtitle")}
            </p>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {t("achievements.vaults.badges.summaryUnlocked", {
              earned: earnedBadges.length,
              total: badges.length,
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("achievements.vaults.badges.loading")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {earnedBadges.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      {t("achievements.vaults.badges.earnedSectionTitle", { count: earnedBadges.length })}
                    </h3>
                  </div>
                  <div className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                    {t("achievements.vaults.badges.progressGood")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
                  {earnedBadges.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} onOpenModal={openModal} />
                  ))}
                </div>
              </div>
            )}

            {lockedBadges.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Lock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Chưa mở khóa ({lockedBadges.length})
                    </h3>
                  </div>
                  <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    Tiếp tục học để mở thêm
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
                  {lockedBadges.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} onOpenModal={openModal} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <OcCredentialModal
        item={modalItem}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onClaim={handleClaim}
        claiming={claiming}
      />
    </div>
  );
}
