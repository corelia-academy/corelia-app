import { useTranslation } from "react-i18next";

/** OCID callback placeholder: route fallback, bootstrap content and the callback loading state. */
export function OCIDRedirectLoading() {
  const { t } = useTranslation("account");
  return (
    <div className="min-h-[60vh]" role="status" aria-live="polite" aria-busy="true">
      <div className="container-app py-10">
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="text-sm text-foreground-muted">
              {t("ocid.redirect.finishing")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
