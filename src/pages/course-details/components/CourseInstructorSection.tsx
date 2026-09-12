import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getPublicProfileById } from "@/lib/profile";
import { parseCourseInstructors } from "@/features/learning/courseInstructors";
import type { CourseInstructorRef } from "@/features/learning/types";
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
import type { InstructorSocialLink, InstructorSocialPlatform, PublicProfile } from "@/types/database";
import type { CourseCoInstructorSnapshot } from "@/types/courses";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CourseInstructorSectionProps {
  profile?: PublicProfile | null;
  instructors?: CourseInstructorRef[];
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
      <p className="line-clamp-4 whitespace-pre-wrap text-body-medium font-body text-foreground/90">
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
  instructors,
}: CourseInstructorSectionProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string) => String(t(key as never));

  const storedAttribution = instructors === undefined ? null : parseCourseInstructors(instructors);
  // Existing co-instructor visibility controls remain authoritative. Newly
  // accepted visible co-instructors must still appear after the one-time backfill.
  const hiddenIds = new Set((coInstructors ?? []).filter(item => item.show_on_course_page === false).map(item => item.id));
  const attributedIds = new Set(storedAttribution?.map(item => item.profile_id));
  const attribution: CourseInstructorRef[] | null = storedAttribution === null ? null : [
    ...storedAttribution.filter(item => !hiddenIds.has(item.profile_id)),
    ...(coInstructors ?? []).filter(item => !hiddenIds.has(item.id) && !attributedIds.has(item.id))
      .map((item, index) => ({ profile_id: item.id, order: storedAttribution.length + index })),
  ];
  const attributionQuery = useQuery({
    queryKey: ["learning-attribution", attribution?.map(item => item.profile_id) ?? []],
    queryFn: () => Promise.all((attribution ?? []).map(item => getPublicProfileById(item.profile_id))),
    enabled: attribution !== null && attribution.length > 0,
    staleTime: 30_000,
  });
  if (attribution !== null) {
    if (attribution.length === 0) return null;
    return <section className="mt-6 rounded-2xl border border-border-subtle bg-surface-base p-4 sm:p-6">
      <h2 className="text-heading-small font-display">{translate("detail.courseDetail.instructor.titlePlural")}</h2>
      {attributionQuery.isPending ? <p role="status">{translate("learning.loading")}</p> : null}
      {attributionQuery.isError ? <div role="alert"><p>{translate("learning.loadError")}</p><Button type="button" variant="outline" onClick={() => void attributionQuery.refetch()}>{translate("learning.retry")}</Button></div> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{attribution.map((item, index) => {
        const person = attributionQuery.data?.[index];
        if (!person) return null;
        return <InstructorCard key={item.profile_id} avatarUrl={person.avatar_url}
          name={person.full_name?.trim() || translate("detail.courseDetail.instructor.fallbackName")}
          meta={item.role_label} bio={person.instructor_bio?.trim() || person.bio?.trim()}
          profileLink={person.role === "instructor" ? `/instructors/${person.id}` : person.username ? `/@${encodeURIComponent(person.username)}` : undefined} />;
      })}</div>
    </section>;
  }
  if (!profile) return null;
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
      <h2 className="text-heading-small font-display text-foreground">{title}</h2>

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
