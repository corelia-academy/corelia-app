import { useTranslation } from "react-i18next";

import { SettingsPage, SettingsSection } from "./SettingsLayout";

export function AccountCvRoute() {
  const { t } = useTranslation("account");
  return (
    <SettingsPage title={t("cv.title")} subtitle={t("cv.subtitle")}>
      <SettingsSection title={t("cv.comingSoon.title")}>
        <p className="text-body-large text-foreground">{t("cv.comingSoon.body")}</p>
        <p className="text-body-medium text-foreground-subtle">{t("cv.comingSoon.note")}</p>
      </SettingsSection>
      <SettingsSection title={t("cv.prep.title")}>
        <ul className="list-disc space-y-1 pl-4 text-body-large text-foreground">
          <li>{t("cv.prep.items.0")}</li>
          <li>{t("cv.prep.items.1")}</li>
          <li>{t("cv.prep.items.2")}</li>
        </ul>
      </SettingsSection>
    </SettingsPage>
  );
}
