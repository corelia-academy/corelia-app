import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildEmailPreview, emailPreviewValues, emailPreviewVariables } from "@/lib/email/preview";

type TemplateDraft = {
  purpose: string; subject: string; preheader: string; image_url: string;
  body_text: string; cta_label: string; cta_url: string;
};

export function TemplatePreview({ mobile, template, locale }: { mobile: boolean; template: TemplateDraft; locale: "vi" | "en" }) {
  const { t } = useTranslation("emailCenter");
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
      {variables.length > 0 && <fieldset className="space-y-2 rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-sm">{t("templates.sampleValues")}</legend>
        {variables.map((key, index) => <div key={key}>
          <Label htmlFor={`email-preview-variable-${index}`}>{key}</Label>
          <Input id={`email-preview-variable-${index}`} value={values[key]} onChange={(event) => setOverrides((previous) => ({ ...previous, [key]: event.target.value }))} />
        </div>)}
      </fieldset>}
      <p className="text-xs text-foreground-muted">{t("templates.previewHelp")}</p>
      {preview.error ? <p role="status" className="text-sm text-destructive">{t(`templates.${preview.error}` as const)}</p> :
        <div className="overflow-x-auto"><iframe title={t("templates.preview")} sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className={`mx-auto block h-[720px] max-w-none border border-border-subtle ${mobile ? "w-[375px]" : "w-[800px]"}`} /></div>}
    </div>
  );
}
