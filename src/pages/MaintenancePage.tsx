import { useTranslation } from "react-i18next";

export default function MaintenancePage() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <img
        src="/logo/corelia-logo-black.svg"
        alt="Corelia"
        className="h-10 dark:hidden"
      />
      <img
        src="/logo/corelia-logo-white.svg"
        alt="Corelia"
        className="hidden h-10 dark:block"
      />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("maintenance.title")}
        </h1>
        <p className="max-w-sm text-sm text-foreground-muted">
          {t("maintenance.body")}
        </p>
      </div>
    </div>
  );
}
