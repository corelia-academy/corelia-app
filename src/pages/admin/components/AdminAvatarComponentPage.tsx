import { useMemo, useState } from "react";
import {
  Award,
  GraduationCap,
  IdCard,
  ImageIcon,
  LogOut,
  Settings,
  UserCircle,
  UsersRound,
} from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import { Action } from "@/components/ui/action";
import {
  AVATAR_SIZES,
  AVATAR_TYPES,
  Avatar,
  AvatarAction,
  AvatarFallback,
  AvatarImage,
  type AvatarType,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGeneratedAvatarDataUrl } from "@/lib/avatar";
import { User } from "@/components/ui/user";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

type AdminAvatarComponentPageProps = {
  embedded?: boolean;
};

type ShowcaseSize = (typeof AVATAR_SIZES)[number];

const sizePixels: Record<ShowcaseSize, number> = {
  Xsmall: 16,
  Small: 24,
  Medium: 32,
  Large: 40,
  XLarge: 48,
  "1.5XLarge": 56,
  "2XLarge": 64,
  "3XLarge": 72,
  "4XLarge": 80,
};

const sizeKeys: Record<ShowcaseSize, string> = {
  Xsmall: "xsmall",
  Small: "small",
  Medium: "medium",
  Large: "large",
  XLarge: "xlarge",
  "1.5XLarge": "xlarge-1-5",
  "2XLarge": "xlarge-2",
  "3XLarge": "xlarge-3",
  "4XLarge": "xlarge-4",
};

const typeKeys: Record<AvatarType, string> = {
  User: "user",
  Disabled: "disabled",
  Text: "text",
  Icon: "icon",
  "Set avatar": "set-avatar",
  "Brand Logos": "brand-logos",
};

const actionSizes = new Set<ShowcaseSize>([
  "XLarge",
  "1.5XLarge",
  "2XLarge",
  "3XLarge",
  "4XLarge",
]);

const userImage = (size: ShowcaseSize) =>
  getGeneratedAvatarDataUrl(`avatar-showcase-${size}`, `issue-382-${size}`);

function AvatarCase({
  fallbackText,
  size,
  type,
}: { fallbackText: string; size: ShowcaseSize; type: AvatarType }) {
  const canShowAction = actionSizes.has(size);
  const avatarUrl = userImage(size);

  return (
    <div
      data-testid={`avatar-case-${typeKeys[type]}-${sizeKeys[size]}`}
      className="flex min-h-24 items-center justify-center px-1"
    >
      <Avatar size={size} type={type} aria-label={`${type} avatar, ${size}`}>
        {type === "User" ? (
          <>
            <AvatarImage src={avatarUrl ?? undefined} alt="Generated user avatar" />
            <AvatarFallback>{fallbackText}</AvatarFallback>
            {canShowAction ? <AvatarAction kind="edit" aria-label="Edit user avatar" /> : null}
          </>
        ) : null}

        {type === "Disabled" ? (
          <>
            <AvatarImage src={avatarUrl ?? undefined} alt="Disabled generated avatar" />
            <AvatarFallback>{fallbackText}</AvatarFallback>
          </>
        ) : null}

        {type === "Text" ? (
          <>
            <AvatarFallback>{fallbackText}</AvatarFallback>
            {canShowAction ? <AvatarAction kind="edit" aria-label="Edit text avatar" /> : null}
          </>
        ) : null}

        {type === "Icon" ? (
          <AvatarFallback>
            <UsersRound aria-hidden="true" />
          </AvatarFallback>
        ) : null}

        {type === "Set avatar" ? (
          <>
            <AvatarFallback>
              <ImageIcon aria-hidden="true" />
            </AvatarFallback>
            {canShowAction ? <AvatarAction kind="add" aria-label="Add avatar" /> : null}
          </>
        ) : null}

        {type === "Brand Logos" ? (
          <>
            <AvatarImage
              src={size === "Xsmall" || size === "Medium" ? "/corelia_favicon.svg" : "/logo/OC-square-logo.svg"}
              alt="Corelia brand logo"
            />
            <AvatarFallback>
              <ImageIcon aria-hidden="true" />
            </AvatarFallback>
          </>
        ) : null}
      </Avatar>
    </div>
  );
}

function AvatarMatrix({ fallbackText }: { fallbackText: string }) {
  return (
    <div data-testid="avatar-matrix" className="overflow-x-auto pb-2">
      <div className="min-w-[860px] space-y-6">
        <div className="grid grid-cols-9 items-end gap-x-6 px-2 text-body-small text-foreground-muted">
          {AVATAR_SIZES.map((size) => (
            <span key={size} className="text-center">
              <span className="block text-foreground">{size}</span>
              <span>{sizePixels[size]}px</span>
            </span>
          ))}
        </div>

        {AVATAR_TYPES.map((type) => (
          <section key={type} data-testid={`avatar-type-row-${typeKeys[type]}`} className="space-y-2">
            <h3 className="px-2 text-body-medium font-semibold text-foreground">{type}</h3>
            <div className="grid grid-cols-9 items-center justify-items-center gap-x-6">
              {AVATAR_SIZES.map((size) => (
                <AvatarCase key={`${type}-${size}`} fallbackText={fallbackText} size={size} type={type} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function UserStatesShowcase({
  displayName,
  metaName,
  profile,
  user,
}: {
  displayName: string;
  metaName: string | null;
  profile: ReturnType<typeof useAuth>["profile"];
  user: ReturnType<typeof useAuth>["user"];
}) {
  const { t } = useTranslation("common");
  const { t: tAccount } = useTranslation("account");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const metaAvatar =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user?.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null;

  const avatarUrl = profile ? profile.avatar_url : metaAvatar;
  const avatarFallback = (
    profile?.full_name ??
    metaName ??
    profile?.id ??
    user?.id ??
    "U"
  ).charAt(0);
  const isOcidConnected = Boolean(profile?.ocid);
  const accountDropdownItems = useMemo(
    () => [
      {
        to: profile?.username?.trim()
          ? `/@${profile.username.trim()}`
          : profile?.ocid?.trim()
            ? `/@${profile.ocid.trim()}`
            : profile?.id
              ? `/@${profile.id}`
              : "/account",
        label: t("header.publicProfile"),
        icon: <UserCircle aria-hidden />,
      },
      {
        to: "/account/profile",
        label: tAccount("nav.profile.title"),
        icon: <UserCircle aria-hidden />,
      },
      ...(profile?.role === "instructor"
        ? [
            {
              to: "/account/instructor",
              label: tAccount("nav.instructor.title"),
              icon: <GraduationCap aria-hidden />,
            },
          ]
        : []),
      {
        to: "/account/cv",
        label: tAccount("nav.cv.title"),
        icon: <IdCard aria-hidden />,
      },
      {
        to: "/achievements",
        label: tAccount("nav.achievements.title"),
        icon: <Award aria-hidden />,
      },
      {
        to: "/account",
        label: tAccount("nav.settings.title"),
        icon: <Settings aria-hidden />,
      },
    ],
    [profile, t, tAccount],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <DropdownMenu
          open={accountMenuOpen}
          onOpenChange={setAccountMenuOpen}
        >
          <DropdownMenuTrigger
            render={
              <User
                showDropdown={false}
                data-testid="avatar-user-trigger-interactive"
                state={accountMenuOpen ? "Clicked" : "Default"}
                className={isOcidConnected ? "text-primary" : "text-foreground"}
                avatar={
                  <UserAvatar
                    userId={profile?.id ?? user?.id}
                    avatarUrl={avatarUrl}
                    avatarSeed={profile?.avatar_seed}
                    alt={displayName}
                    fallback={avatarFallback}
                    size="Medium"
                    className="transition-[box-shadow,background-color] group-hover/user:bg-surface-raised group-hover/user:ring-2 group-hover/user:ring-primary/20"
                  />
                }
              >
                <span className="block max-w-48 truncate">
                  {displayName}
                </span>
              </User>
            }
          />
          <DropdownMenuContent
            align="start"
            className="z-20 min-w-64"
            data-testid="avatar-user-menu"
          >
            {accountDropdownItems.map((item) => (
              <Action
                key={`${item.to}-${item.label}`}
                role="menuitem"
                variant="default"
                size="small"
                icon={item.icon}
                label={item.label}
                showActive={false}
                showPressed
                type="button"
              />
            ))}
            <DropdownMenuSeparator />
            <Action
              role="menuitem"
              type="button"
              variant="destructive"
              size="small"
              icon={<LogOut aria-hidden />}
              label={t("tabs.signOut")}
              isActive={false}
              showActive={false}
              hoverAsActive
              showPressed
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function AdminAvatarComponentPage({
  embedded = false,
}: AdminAvatarComponentPageProps) {
  const { profile, user } = useAuth();
  const { t } = useTranslation("common");

  const metaName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const displayName = profile?.ocid
    ? profile.ocid
    : (profile?.full_name ??
      metaName ??
      profile?.id?.slice(0, 8) ??
      t("user.fallbackName"));
  const avatarText = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <ComponentShowcaseLayout
      title="Avatar"
      description="Inspect the complete Avatar size and type contract from Figma issue #382."
      embedded={embedded}
    >
      <ShowcaseSection
        title="All sizes and types"
        criterion="The matrix renders all 54 combinations from the shared AVATAR_SIZES and AVATAR_TYPES contracts."
      >
        <AvatarMatrix fallbackText={avatarText} />
      </ShowcaseSection>

      <ShowcaseSection
        title="Interactive header user"
        criterion="The current authenticated user uses the Header data flow, keeps the Figma User shape, and opens the same account actions while switching between Default and Clicked."
      >
        <UserStatesShowcase
          displayName={displayName}
          metaName={metaName}
          profile={profile}
          user={user}
        />
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
