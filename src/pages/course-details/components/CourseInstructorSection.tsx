import {
  Globe,
  Github,
  Linkedin,
  Twitter,
  Youtube,
  Facebook,
  Instagram,
} from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { InstructorSocialLink, InstructorSocialPlatform, Profile } from "@/types/database";
import type { CourseCoInstructorSnapshot } from "@/types/courses";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CourseInstructorSectionProps {
  profile: Profile;
  coInstructors?: CourseCoInstructorSnapshot[];
}

function initials(name: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

function SocialIcon({ platform }: { platform: InstructorSocialPlatform }) {
  switch (platform) {
    case "github":
      return <Github className="size-4" aria-hidden />;
    case "linkedin":
      return <Linkedin className="size-4" aria-hidden />;
    case "twitter":
      return <Twitter className="size-4" aria-hidden />;
    case "youtube":
      return <Youtube className="size-4" aria-hidden />;
    case "facebook":
      return <Facebook className="size-4" aria-hidden />;
    case "instagram":
      return <Instagram className="size-4" aria-hidden />;
    default:
      return <Globe className="size-4" aria-hidden />;
  }
}

const PLATFORM_LABELS: Record<InstructorSocialPlatform, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  website: "Website",
  other: "Link",
};

function getSocialLabel(link: InstructorSocialLink): string {
  if (link.label && link.label.trim()) return link.label.trim();
  return PLATFORM_LABELS[link.platform] ?? "Link";
}

function InstructorCard({
  avatarUrl,
  name,
  meta,
  bio,
  socialLinks,
  profileLink,
}: {
  avatarUrl?: string | null;
  name: string;
  meta?: string;
  bio?: string;
  socialLinks?: InstructorSocialLink[];
  profileLink?: string;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div className="flex items-start gap-3">
        <Avatar className="mt-0.5 size-12 shrink-0 rounded-full border border-border-subtle">
          <AvatarImage src={avatarUrl || undefined} alt={name} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {profileLink ? (
              <Link to={profileLink} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </div>
          {meta ? (
            <div className="mt-0.5 text-sm text-foreground-muted">{meta}</div>
          ) : null}

          {socialLinks && socialLinks.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {socialLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs font-medium text-foreground-muted transition-colors hover:border-border hover:text-foreground"
                >
                  <SocialIcon platform={link.platform} />
                  {getSocialLabel(link)}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {bio ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {bio}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function CourseInstructorSection({
  profile,
  coInstructors,
}: CourseInstructorSectionProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string) => String(t(key as never));

  const mainName = profile.full_name?.trim() || translate("detail.courseDetail.instructor.fallbackName");
  const mainMeta = [profile.instructor_headline, profile.instructor_organization]
    .filter(Boolean)
    .join(" • ");
  const mainBio = profile.instructor_bio?.trim() || profile.bio?.trim();

  const mainSocialLinks: InstructorSocialLink[] = [...(profile.instructor_social_links ?? [])];
  if (profile.instructor_website?.trim()) {
    const alreadyHas = mainSocialLinks.some((l) => l.url === profile.instructor_website);
    if (!alreadyHas) {
      mainSocialLinks.push({ platform: "website", url: profile.instructor_website });
    }
  }

  const visibleCoInstructors = (coInstructors ?? []).filter(
    (p) => p.show_on_course_page !== false,
  );
  const hasCoInstructors = visibleCoInstructors.length > 0;
  const title = hasCoInstructors
    ? translate("detail.courseDetail.instructor.titlePlural")
    : translate("detail.courseDetail.instructor.title");

  return (
    <section className="mt-6 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InstructorCard
          avatarUrl={profile.avatar_url}
          name={mainName}
          meta={mainMeta}
          bio={mainBio}
          socialLinks={mainSocialLinks}
          profileLink={`/instructors/${profile.id}`}
        />

        {hasCoInstructors
          ? visibleCoInstructors.map((p) => {
              const label =
                (p.name ?? "").trim() ||
                translate("detail.courseDetail.coInstructors.fallbackName");
              const meta = [p.headline, p.organization].filter(Boolean).join(" • ");
              const coSocialLinks: InstructorSocialLink[] = p.website?.trim()
                ? [{ platform: "website", url: p.website }]
                : [];

              return (
                <InstructorCard
                  key={p.id}
                  avatarUrl={p.avatar_url}
                  name={label}
                  meta={meta}
                  bio={p.bio?.trim()}
                  socialLinks={coSocialLinks}
                  profileLink={`/instructors/${p.id}`}
                />
              );
            })
          : null}
      </div>
    </section>
  );
}
