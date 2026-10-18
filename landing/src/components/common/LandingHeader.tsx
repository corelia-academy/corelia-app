import { useEffect, useState } from "react";
import {
  AccountMenu,
  AuthActions,
  LanguageMenu,
  SITE_HEADER_COPY,
  SearchLink,
  SiteHeader,
  readSiteSession,
  siteAccountLinks,
  siteHomeHref,
  siteNavigation,
  type SiteSessionUser,
} from "@corelia/ui/site-header";
import { localizePath, rememberLocale, stripLocalePrefix, type SiteLocale } from "@corelia/ui/locales";
import "@corelia/ui/site-header.css";

/** Locales the marketing pages exist in; catalog pages pass every site locale. */
const MARKETING_LOCALES = ["en", "vi"] as const satisfies readonly SiteLocale[];

type Props = {
  lang: SiteLocale;
  /** Locales this page exists in (the language menu only offers these). */
  locales?: readonly SiteLocale[];
  currentPath: string;
  /** Alternate URLs of this page per locale (blog posts have translated slugs). */
  languageHrefs?: Partial<Record<string, string>>;
  /** Where the learning app lives on this origin. */
  appUrl: string;
};

export default function LandingHeader({ lang, locales = MARKETING_LOCALES, currentPath, languageHrefs, appUrl }: Props) {
  const copy = SITE_HEADER_COPY[lang];
  // Unknown until hydration: the session lives in the browser (the app's Supabase storage).
  const [user, setUser] = useState<SiteSessionUser | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setUser(readSiteSession());
    sync();
    // Signing in or out in another tab updates the button here.
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const next = encodeURIComponent(stripLocalePrefix(currentPath));
  const auth = {
    signInHref: `${appUrl}/login?next=${next}`,
    signUpHref: `${appUrl}/login?mode=signup&next=${next}`,
    appHref: `${appUrl}/`,
    labels: copy,
  };

  const switchLanguage = (locale: SiteLocale) => {
    rememberLocale(locale);
    window.location.assign(languageHrefs?.[locale] ?? localizePath(stripLocalePrefix(currentPath), locale));
  };

  return (
    <SiteHeader
      position="fixed"
      logo={{ href: siteHomeHref(lang), src: "/Corelia_Academy_Logo_Dark.png", alt: "Corelia Academy" }}
      nav={siteNavigation(lang)}
      activePath={currentPath}
      labels={copy}
      end={
        <>
          <LanguageMenu locale={lang} locales={locales} label={copy.language} onSelect={switchLanguage} />
          <SearchLink href={`${appUrl}/search`} label={copy.search} />
          {user ? (
            <AccountMenu
              user={user}
              items={siteAccountLinks(lang, appUrl)}
              signOut={{ label: copy.signOut, href: `${appUrl}/logout` }}
              label={copy.account}
            />
          ) : (
            <AuthActions user={user} {...auth} />
          )}
        </>
      }
      mobileFooter={user ? undefined : <AuthActions user={user} {...auth} stacked />}
    />
  );
}
