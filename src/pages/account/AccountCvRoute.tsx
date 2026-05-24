import { useTranslation } from "react-i18next";

function CvSection() {
  const { t } = useTranslation("account");
  return (
    <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("cv.title")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("cv.subtitle")}
        </p>
      </div>

      <div className="space-y-3 rounded-md bg-surface-raised p-3 text-sm">
        <p className="font-medium">{t("cv.comingSoon.title")}</p>
        <p className="text-foreground-muted">
          {t("cv.comingSoon.body")}
        </p>
        <p className="text-xs text-foreground-muted">
          {t("cv.comingSoon.note")}
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <h3 className="font-medium">{t("cv.prep.title")}</h3>
        <ul className="list-disc space-y-1 pl-4 text-foreground-muted">
          <li>{t("cv.prep.items.0")}</li>
          <li>{t("cv.prep.items.1")}</li>
          <li>{t("cv.prep.items.2")}</li>
        </ul>
      </div>
    </div>
  );
}

export function AccountCvRoute() {
  return <CvSection />;
}

