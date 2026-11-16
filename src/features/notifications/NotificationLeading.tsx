import { Bell, Certificate, ChalkboardTeacher, EyeSlash, GraduationCap, Medal, Megaphone, SealCheck, Trophy, UsersThree, XCircle, type Icon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { optimizedImageUrl } from "@/lib/imageUrl";

const ICONS: Record<string, Icon> = {
  project_collaboration_invite: UsersThree,
  co_instructor_invite: ChalkboardTeacher,
  hackathon_registration_approved: SealCheck,
  hackathon_registration_rejected: XCircle,
  hackathon_winner_award: Trophy,
  course_announcement: Megaphone,
  course_completed: GraduationCap,
  course_certificate_issued: Certificate,
  oc_credential_minted: Medal,
  project_auto_hidden: EyeSlash,
};

export function NotificationTypeIcon({ type }: { type: string }) {
  const Glyph = ICONS[type] ?? Bell;
  return <Avatar size="Medium" type="Icon"><AvatarFallback><Glyph weight="duotone" aria-hidden /></AvatarFallback></Avatar>;
}

/** Invite rows show the project's or course's own image; the type icon stays as the fallback when there is none or it fails to load. */
export function NotificationInviteAvatar({ type, imageUrl }: { type: string; imageUrl?: string | null }) {
  if (!imageUrl) return <NotificationTypeIcon type={type} />;
  const Glyph = ICONS[type] ?? Bell;
  return (
    <Avatar size="Medium" type="Brand Logos" className="border border-border-subtle">
      <AvatarImage src={optimizedImageUrl(imageUrl, { width: 64, resize: "contain" })} alt="" />
      <AvatarFallback><Glyph weight="duotone" aria-hidden /></AvatarFallback>
    </Avatar>
  );
}
