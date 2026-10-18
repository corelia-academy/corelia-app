import { useEffect, useState } from "react";
import {
  AuthActions,
  LanguageMenu,
  SITE_HEADER_COPY,
  SiteHeader,
  readSiteSession,
  siteNavigation,
  type SiteSessionUser,
} from "@corelia/ui/site-header";
import { localizePath, rememberLocale, stripLocalePrefix, type SiteLocale } from "@corelia/ui/locales";
import "@corelia/ui/site-header.css";

/** Locales the landing site has pages for. */
const LANDING_LOCALES = ["en", "vi"] as const satisfies readonly SiteLocale[];

type Props = {
  lang: (typeof LANDING_LOCALES)[number];
  currentPath: string;
  /** Alternate URLs of this page per locale (blog posts have translated slugs). */
  languageHrefs?: Partial<Record<string, string>>;
  /** Where the learning app lives on this origin. */
  appUrl: string;
};

export default function LandingHeader({ lang, currentPath, languageHrefs, appUrl }: Props) {
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
      logo={{ href: localizePath("/", lang), src: "/Corelia_Academy_Logo_Dark.png", alt: "Corelia Academy" }}
      nav={siteNavigation(lang)}
      activePath={currentPath}
      labels={copy}
      end={
        <>
          <LanguageMenu locale={lang} locales={LANDING_LOCALES} label={copy.language} onSelect={switchLanguage} />
          <AuthActions user={user} {...auth} />
        </>
      }
      mobileFooter={<AuthActions user={user} {...auth} stacked />}
    />
  );
}
