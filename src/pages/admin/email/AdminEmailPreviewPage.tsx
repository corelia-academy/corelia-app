import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type PreviewEntry = {
  file: string;
  group: string;
  title: string;
};

export default function AdminEmailPreviewPage() {
  const { t, i18n } = useTranslation("emailCenter");
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${import.meta.env.BASE_URL}email-preview/manifest.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("preview_manifest_unavailable");
        return response.json() as Promise<PreviewEntry[]>;
      })
      .then((nextEntries) => {
        if (!Array.isArray(nextEntries)) throw new Error("preview_manifest_invalid");
        setEntries(nextEntries);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  const locale = (i18n.resolvedLanguage ?? i18n.language).startsWith("en") ? "en" : "vi";
  const localizedEntries = entries.filter((entry) => entry.file.endsWith(`-${locale}.html`));
  const selectedEntry = localizedEntries.find((entry) => entry.file === `${selectedTemplate}-${locale}.html`) ?? localizedEntries[0];
  const previewUrl = (file: string) => `${import.meta.env.BASE_URL}email-preview/${file}`;

  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("previewGallery.title")}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t("previewGallery.subtitle")}</p>
        </div>
        <div className="w-full sm:w-80">
          <Label htmlFor="email-preview-template">{t("previewGallery.template")}</Label>
          <select
            id="email-preview-template"
            className="mt-1 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
            value={selectedEntry?.file.replace(/-(vi|en)\.html$/, "") ?? ""}
            onChange={(event) => setSelectedTemplate(event.target.value)}
            disabled={status !== "ready" || localizedEntries.length === 0}
          >
            {localizedEntries.map((entry) => (
              <option key={entry.file} value={entry.file.replace(/-(vi|en)\.html$/, "")}>{entry.group} · {entry.title.replace(/ · (VI|EN)$/, "")}</option>
            ))}
          </select>
        </div>
      </div>

      {status === "loading" ? <p className="text-sm text-foreground-muted">{t("previewGallery.loading")}</p> : null}
      {status === "error" ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{t("previewGallery.failed")}</p> : null}
      {status === "ready" && !selectedEntry ? <p className="text-sm text-foreground-muted">{t("previewGallery.empty")}</p> : null}

      {selectedEntry ? (
        <Card key={selectedEntry.file}>
          <CardContent className="p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{selectedEntry.group}</p>
                <h2 className="mt-1 font-semibold">{selectedEntry.title}</h2>
              </div>
              <a
                className="text-sm text-primary underline underline-offset-4"
                href={previewUrl(selectedEntry.file)}
                target="_blank"
                rel="noreferrer"
              >
                {t("previewGallery.open")}
              </a>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,800px)_375px] xl:justify-center">
              <PreviewFrame icon={<Monitor className="size-4" aria-hidden />} label={t("previewGallery.desktop")} src={previewUrl(selectedEntry.file)} width="w-[800px]" title={`${selectedEntry.title} desktop`} />
              <PreviewFrame icon={<Smartphone className="size-4" aria-hidden />} label={t("previewGallery.mobile")} src={previewUrl(selectedEntry.file)} width="w-[375px]" title={`${selectedEntry.title} mobile`} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function PreviewFrame({ icon, label, src, title, width }: { icon: ReactNode; label: string; src: string; title: string; width: string }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground-muted">{icon}{label}</div>
      <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-base p-1">
        <iframe
          title={title}
          sandbox=""
          referrerPolicy="no-referrer"
          loading="lazy"
          src={src}
          className={`block h-[820px] max-w-none bg-[#0a0913] ${width}`}
        />
      </div>
    </section>
  );
}
