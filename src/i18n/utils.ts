import { defaultLang, translations } from "./translations";

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split("/");
  if (lang in translations) return lang as keyof typeof translations;
  return defaultLang;
}

export function stripLangPrefix(pathname: string) {
  const parts = pathname.split("/");
  const maybeLang = parts[1];
  if (maybeLang && maybeLang in translations) {
    const rest = `/${parts.slice(2).join("/")}`.replace(/\/+$/, "");
    return rest === "" ? "/" : rest;
  }
  return pathname;
}

export function useTranslatedPath(lang: keyof typeof translations) {
  return function translatePath(path: string, l: string = lang) {
    return l === defaultLang ? path : `/${l}${path}`;
  };
}
