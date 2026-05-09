import { useTranslation } from "react-i18next";

export function LoginTerms() {
  const { t } = useTranslation("auth");
  return (
    <p className="px-2 text-center text-xs text-foreground-muted">
      {t("login.terms.prefix")}
      <a
        href="https://corelia.academy/terms"
        className="underline underline-offset-2 hover:no-underline"
        target="_blank"
        rel="noreferrer"
      >
        {t("login.terms.termsOfUse")}
      </a>{" "}
      {t("login.terms.and")}
      <a
        href="https://corelia.academy/policy"
        className="underline underline-offset-2 hover:no-underline"
        target="_blank"
        rel="noreferrer"
      >
        {t("login.terms.privacyPolicy")}
      </a>
      {t("login.terms.suffix")}
    </p>
  );
}

