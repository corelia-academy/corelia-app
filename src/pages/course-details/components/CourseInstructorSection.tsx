import {
  Globe,
  Github,
  Linkedin,
  Twitter,
  Youtube,
  Facebook,
  Instagram,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InstructorSocialLink, InstructorSocialPlatform, Profile } from "@/types/database";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CourseInstructorSectionProps {
  profile: Profile;
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

export function CourseInstructorSection({ profile }: CourseInstructorSectionProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string) => String(t(key as never));

  const displayName = profile.full_name?.trim() || translate("detail.courseDetail.instructor.fallbackName");
  const meta = [profile.instructor_headline, profile.instructor_organization]
    .filter(Boolean)
    .join(" • ");

  const bio = profile.instructor_bio?.trim() || profile.bio?.trim();

  const socialLinks: InstructorSocialLink[] = [
    ...(profile.instructor_social_links ?? []),
  ];
  if (profile.instructor_website?.trim()) {
    const alreadyHasWebsite = socialLinks.some(
      (l) => l.url === profile.instructor_website,
    );
    if (!alreadyHasWebsite) {
      socialLinks.push({ platform: "website", url: profile.instructor_website });
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        {translate("detail.courseDetail.instructor.title")}
      </h2>

      <div className="mt-4 flex items-start gap-4">
        <Avatar className="mt-0.5 size-14 shrink-0 rounded-full border border-border-subtle">
          <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="text-base">{initials(profile.full_name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          {meta ? (
            <p className="mt-0.5 text-sm text-foreground-muted">{meta}</p>
          ) : null}

          {socialLinks.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-4 border-t border-border-subtle pt-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {bio}
          </p>
        </div>
      ) : null}
    </section>
  );
}
