import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildEmailPreview, emailPreviewValues, emailPreviewVariables } from "@/lib/email/preview";

type TemplateDraft = {
  purpose: string; subject: string; preheader: string; image_url: string;
  body_text: string; cta_label: string; cta_url: string;
};

export function TemplatePreview({ mobile, template }: { mobile: boolean; template: TemplateDraft }) {
  const { t, i18n } = useTranslation("emailCenter");
  const [locale, setLocale] = useState(i18n.resolvedLanguage?.startsWith("vi") ? "vi" : "en");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const draft = {
    purpose: template.purpose, subject: template.subject || t("templates.subject"),
    preheader: template.preheader, bodyText: template.body_text || t("templates.body"),
    ctaLabel: template.cta_label, ctaUrl: template.cta_url, imageUrl: template.image_url, locale,
  };
  const values = emailPreviewValues(draft, window.location.origin, overrides);
  const variables = emailPreviewVariables(draft);
  const preview = buildEmailPreview(draft, window.location.origin, values);
  return (
    <div className="mt-4 min-w-0 space-y-4">
      <div>
        <Label htmlFor="email-preview-locale">{t("templates.previewLocale")}</Label>
        <select id="email-preview-locale" className="mt-1 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm" value={locale} onChange={(event) => setLocale(event.target.value)}>
          <option value="vi">Tiếng Việt</option><option value="en">English</option>
        </select>
      </div>
      {variables.length > 0 && <fieldset className="space-y-2 rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-sm">{t("templates.sampleValues")}</legend>
        {variables.map((key, index) => <div key={key}>
          <Label htmlFor={`email-preview-variable-${index}`}>{key}</Label>
          <Input id={`email-preview-variable-${index}`} value={values[key]} onChange={(event) => setOverrides((previous) => ({ ...previous, [key]: event.target.value }))} />
        </div>)}
      </fieldset>}
      <p className="text-xs text-foreground-muted">{t("templates.previewHelp")}</p>
      {preview.error ? <p role="status" className="text-sm text-destructive">{t(`templates.${preview.error}` as const)}</p> :
        <iframe title={t("templates.preview")} sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className={`mx-auto block h-[720px] w-full border border-border-subtle ${mobile ? "max-w-[375px]" : "max-w-[800px]"}`} />}
    </div>
  );
}
