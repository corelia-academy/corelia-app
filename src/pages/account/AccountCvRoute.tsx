import { useTranslation } from "react-i18next";

function CvSection() {
  const { t } = useTranslation("account");
  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold">{t("cv.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("cv.subtitle")}
        </p>
      </div>

      <div className="space-y-3 rounded-md bg-muted/60 p-3 text-sm">
        <p className="font-medium">{t("cv.comingSoon.title")}</p>
        <p className="text-muted-foreground">
          {t("cv.comingSoon.body")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("cv.comingSoon.note")}
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <h3 className="font-medium">{t("cv.prep.title")}</h3>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
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

