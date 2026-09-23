import {
  Code,
  DiscordLogo,
  FileText,
  GithubLogo,
  Globe,
  LinkSimple,
  TelegramLogo,
  UsersThree,
  YoutubeLogo,
} from "@phosphor-icons/react";
import type { CourseResourceIcon as CourseResourceIconName } from "@/types/courses";

const ICONS = {
  link: LinkSimple,
  github: GithubLogo,
  discord: DiscordLogo,
  telegram: TelegramLogo,
  youtube: YoutubeLogo,
  document: FileText,
  code: Code,
  community: UsersThree,
  website: Globe,
} satisfies Record<CourseResourceIconName, typeof LinkSimple>;

export function CourseResourceIcon({ icon = "link", className = "size-5" }: {
  icon?: CourseResourceIconName;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? LinkSimple;
  return <Icon data-slot="course-resource-icon" className={className} weight="duotone" aria-hidden />;
}
