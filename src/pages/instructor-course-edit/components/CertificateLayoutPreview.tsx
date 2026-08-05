import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageOff, Loader2 } from "lucide-react";

import { renderCertificateBlob } from "@/pages/achievements/utils/renderCertificate";
import type { CertificateLayoutSettings } from "@/pages/achievements/utils/certificateLayout";

type Props = {
  templateUrl: string;
  settings: CertificateLayoutSettings;
  nameColor: string;
  footerColor: string;
};

const SAMPLE_CODE = "CRL-PREVIEW01";
const DEBOUNCE_MS = 300;

/** Live preview of the certificate layout while the instructor adjusts coordinates.
 *
 *  Renders through the same `renderCertificateBlob` the learner's PNG, the PDF and
 *  the public /verify page use, so what the instructor positions here is exactly what
 *  ships. It takes no userId or courseId on purpose: `renderAndUploadCertificate` is
 *  the only function that writes to storage, so this component structurally cannot
 *  upload anything. */
export function CertificateLayoutPreview({
  templateUrl,
  settings,
  nameColor,
  footerColor,
}: Props) {
  const { t } = useTranslation("instructor");
  const template = templateUrl.trim();

  // The parent rebuilds `settings` on every render, so re-key the effect on the
  // serialized values instead of object identity — otherwise it would re-render the
  // canvas on every keystroke anywhere in the form.
  const settingsKey = JSON.stringify(settings);
  const stableSettings = useMemo(
    () => JSON.parse(settingsKey) as CertificateLayoutSettings,
    [settingsKey],
  );

  // Tagged with the inputs it was drawn from, so the rendered/rendering state is
  // derived rather than reset from inside the effect.
  const renderKey = `${template}|${settingsKey}|${nameColor}|${footerColor}`;
  const [rendered, setRendered] = useState<{ key: string; url: string } | null>(null);
  const previewUrl = rendered?.key === renderKey ? rendered.url : null;
  const rendering = Boolean(template) && previewUrl === null;

  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    const timer = setTimeout(() => {
      void renderCertificateBlob({
        imageUrl: template,
        holderName: t("courseEdit.certificate.previewSampleName"),
        verificationCode: SAMPLE_CODE,
        issuedAtIso: new Date().toISOString(),
        nameColor,
        footerColor,
        ...stableSettings,
      })
        .then((blob) => {
          if (cancelled || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setRendered({ key: renderKey, url: objectUrl });
        })
        .catch(() => {
          // Preview only — a failed render must never block editing.
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [template, stableSettings, nameColor, footerColor, renderKey, t]);

  return (
    <div className="mb-6 rounded-2xl border border-border-subtle bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {t("courseEdit.certificate.previewTitle")}
        </p>
        {rendering && (
          <Loader2 className="size-4 animate-spin text-foreground-muted" aria-hidden />
        )}
      </div>

      {!template ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-subtle px-4 py-10 text-center">
          <ImageOff className="size-6 text-foreground-muted" aria-hidden />
          <p className="text-xs text-foreground-muted">
            {t("courseEdit.certificate.previewNoTemplate")}
          </p>
        </div>
      ) : previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="w-full rounded-lg border border-border-subtle"
        />
      ) : (
        <div className="aspect-4/3 w-full animate-pulse rounded-lg border border-border-subtle bg-surface-base" />
      )}

      <p className="mt-2 text-xs text-foreground-muted">
        {t("courseEdit.certificate.previewHint")}
      </p>
    </div>
  );
}
