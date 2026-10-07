import { useTranslation } from "react-i18next";

import { FullPageEmptyState } from "@/components/layouts/FullPageEmptyState";

export default function AdminFullPageEmptyStateComponentPage() {
  const { t } = useTranslation("courses");

  return (
    <FullPageEmptyState
      title={t("catalog.noCoursesTitle")}
      description={t("catalog.noCoursesDescription")}
    />
  );
}
