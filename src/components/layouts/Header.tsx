import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, NavLink, useLocation } from "react-router";
import { XpRankBadge } from "@/features/xp/XpRankBadge";
import { XpBadge } from "@/features/xp/XpBadge";
import { getXpTotals } from "@/lib/xp";
import { getGeneratedAvatarDataUrl } from "@/lib/avatar";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { NotificationBell } from "@/components/layouts/NotificationBell";
import { useTheme } from "next-themes";
import { prefetchRouteChunk } from "@/lib/routePrefetch";
import { APP_BASE_PATH, appPath, isAppPath, stripAppBasePath } from "@/lib/appUrl";
import { ROLE_GROUPS } from "@/config/roles";
import { useLocale } from "@/hooks/useLocale";
import {
  AccountMenu,
  AuthActions,
  LanguageMenu,
  SITE_HEADER_COPY,
  SearchLink,
  SiteHeader,
  siteAccountLinks,
  siteHomeHref,
  siteNavigation,
  writeSiteUser,
  type SiteHeaderLinkProps,
} from "@corelia/ui/site-header";
import "@corelia/ui/site-header.css";

/** App paths stay in the router; landing pages (domain root) are full-page links. */
function renderSiteLink({ href, children, ...props }: SiteHeaderLinkProps) {
  if (!isAppPath(href)) return <a href={href} {...props}>{children}</a>;
  const to = stripAppBasePath(href);
  return (
    <NavLink
      to={to}
      end={to === "/"}
      {...props}
      onPointerEnter={() => prefetchRouteChunk(to)}
      onFocus={() => prefetchRouteChunk(to)}
    >
      {children}
    </NavLink>
  );
}

/**
 * The site header shared with the landing site (same logo target, navigation, language menu,
 * search and account menu). The app adds the notification bell and role-based workspaces.
 */
export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile, authInitialized, signOut, user, hasRole } = useAuth();
  const { t } = useTranslation("common");
  const { t: tAccount } = useTranslation("account");
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const { language, setLanguage } = useLocale();
  const siteCopy = SITE_HEADER_COPY[language];
  const returnTo = `${location.pathname}${location.search}`;

  const metaName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const metaAvatar =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user?.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null;

  const displayName = profile?.ocid
    ? profile.ocid
    : (profile?.full_name ??
      metaName ??
      profile?.id?.slice(0, 8) ??
      t("user.fallbackName"));
  const userId = profile?.id ?? user?.id ?? null;
  // Same image the app's UserAvatar renders; the landing header reads it from the snapshot below.
  const avatarUrl = useMemo(
    () => getGeneratedAvatarDataUrl(userId, profile?.avatar_seed, profile?.avatar_config)
      ?? (profile ? profile.avatar_url : metaAvatar),
    [metaAvatar, profile, userId],
  );

  useEffect(() => {
    if (!isAuthenticated || !userId || !profile) return;
    writeSiteUser({ id: userId, name: displayName, avatarUrl });
  }, [avatarUrl, displayName, isAuthenticated, profile, userId]);
  const xpQuery = useQuery({
    queryKey: ["xp", "total", user?.id],
    queryFn: async () => {
      return getXpTotals([user!.id]);
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const canTeach = isAuthenticated && hasRole(ROLE_GROUPS.instructorWorkspace);
  const canAdmin = isAuthenticated && hasRole(ROLE_GROUPS.admin);
  const accountItems = useMemo(() => {
    const publicProfile = profile?.username?.trim()
      ? `/@${profile.username.trim()}`
      : profile?.ocid?.trim()
        ? `/@${profile.ocid.trim()}`
        : profile?.id
          ? `/@${profile.id}`
          : null;
    return [
      ...siteAccountLinks(language, APP_BASE_PATH),
      ...(publicProfile ? [{ label: t("header.publicProfile"), href: appPath(publicProfile) }] : []),
      ...(profile?.role === "instructor"
        ? [{ label: tAccount("nav.instructor.title"), href: appPath("/account/instructor") }]
        : []),
      ...(canTeach ? [{ label: t("nav.instructor"), href: appPath("/instructor/courses") }] : []),
      ...(canAdmin ? [{ label: t("nav.admin"), href: appPath("/admin") }] : []),
    ];
  }, [canAdmin, canTeach, language, profile, t, tAccount]);

  const guestAuth = {
    user: null,
    signInHref: appPath(`/login?next=${encodeURIComponent(returnTo)}`),
    signUpHref: appPath(`/login?mode=signup&next=${encodeURIComponent(returnTo)}`),
    appHref: appPath("/"),
    labels: siteCopy,
    renderLink: renderSiteLink,
  };

  return (
    <SiteHeader
      logo={{
        href: siteHomeHref(language),
        src: isDarkMode ? appPath("/logo/Corelia_Logo_White.svg") : appPath("/logo/corelia-full-logo-black.png"),
        alt: "Corelia",
      }}
      nav={siteNavigation(language)}
      renderLink={renderSiteLink}
      labels={siteCopy}
      end={
        <>
          <LanguageMenu locale={language} label={siteCopy.language} onSelect={(lng) => void setLanguage(lng)} />
          <SearchLink href={appPath("/search")} label={siteCopy.search} renderLink={renderSiteLink} />
          {!authInitialized ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-surface-raised md:h-10" />
          ) : isAuthenticated ? (
            <>
              <NotificationBell />
              <AccountMenu
                user={{ name: displayName, email: user?.email ?? null, avatarUrl }}
                summary={user?.id ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <XpBadge total={xpQuery.data?.[user.id]} />
                    <XpRankBadge total={xpQuery.data?.[user.id]} />
                  </span>
                ) : null}
                items={accountItems}
                signOut={{
                  label: siteCopy.signOut,
                  onSelect: () => void signOut().then(() => navigate("/login", { replace: true })),
                }}
                label={siteCopy.account}
                renderLink={renderSiteLink}
              />
            </>
          ) : (
            <AuthActions {...guestAuth} />
          )}
        </>
      }
      mobileFooter={authInitialized && !isAuthenticated ? <AuthActions {...guestAuth} stacked /> : undefined}
    />
  );
}
