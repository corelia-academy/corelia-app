import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { Plus, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { projectErrorMessage } from "@/lib/projectErrors";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { deleteProjectMedia, uploadProjectMedia } from "@/lib/projectSubmission";

export type ProjectMediaItem = { path: string; url: string };

type Props = {
  projectId: string;
  logo: ProjectMediaItem | null;
  screenshots: ProjectMediaItem[];
  onLogoChange: (logo: ProjectMediaItem | null) => void;
  onScreenshotsChange: (screenshots: ProjectMediaItem[]) => void;
  deleteOnRemove?: boolean;
  onRemovePath?: (path: string) => void;
  onUploadPath?: (path: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  presentation?: "default" | "submission";
};

const ACCEPT = "image/png,image/jpeg,image/webp";

type DashedUploadSlotProps = {
  className: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
  onDropFiles: (files: File[]) => void;
};

function DashedUploadSlot({ className, label, disabled, onClick, onDropFiles }: DashedUploadSlotProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-project-media-upload-placeholder-surface ${dragOver ? "ring-2 ring-inset ring-primary" : ""} ${className}`}
      onDragOver={event => {
        event.preventDefault();
        if (!disabled) {
          event.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }
      }}
      onDragLeave={event => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setDragOver(false);
        }
      }}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        if (!disabled) onDropFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Separator
        shape="frame"
        variant="dashed"
        dashPattern={{ dashLength: 12, gapLength: 4 }}
        className="absolute inset-0 z-10 h-auto w-auto rounded-md border-border"
        aria-hidden
      />
      <Button
        type="button"
        size="small"
        variant="cta"
        hierarchy="tertiary"
        className="absolute inset-0 z-20 h-full w-full rounded-md border-0 bg-transparent p-0 hover:bg-transparent active:bg-transparent"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Plus className="size-4 text-neutral-200" weight="regular" aria-hidden />
      </Button>
    </div>
  );
}

export function ProjectMediaEditor({
  projectId,
  logo,
  screenshots,
  onLogoChange,
  onScreenshotsChange,
  deleteOnRemove = true,
  onRemovePath,
  onUploadPath,
  onUploadingChange,
  presentation = "default",
}: Props) {
  const { t } = useTranslation("common");
  const [uploading, setUploadingState] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const screenshotsInput = useRef<HTMLInputElement>(null);
  function setUploading(value: boolean) { setUploadingState(value); onUploadingChange?.(value); }

  function validFile(kind: "logo" | "screenshot", file: File): boolean {
    const max = kind === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!ACCEPT.split(",").includes(file.type) || file.size <= 0 || file.size > max) {
      toast.error(t(kind === "logo" ? "projects.form.logoInvalid" : "projects.form.screenshotInvalid"));
      return false;
    }
    return true;
  }

  async function uploadLogo(file: File | undefined) {
    if (uploading || !file || !validFile("logo", file)) return;
    setUploading(true);
    try {
      const result = await uploadProjectMedia(projectId, "logo", file);
      const item = { path: result.path, url: result.signed_url };
      onUploadPath?.(item.path);
      const previous = logo;
      onLogoChange(item);
      if (previous) {
        if (deleteOnRemove) void deleteProjectMedia(projectId, previous.path).catch(() => undefined);
        else onRemovePath?.(previous.path);
      }
    } catch (error) {
      toast.error(projectErrorMessage(error, t));
    } finally {
      setUploading(false);
    }
  }

  async function uploadScreenshots(files: File[]) {
    if (uploading || !files.length) return;
    const available = 6 - screenshots.length;
    if (available <= 0) {
      toast.error(t("projects.form.screenshotLimit"));
      return;
    }
    const selected = files.slice(0, available);
    if (files.length > available) toast.error(t("projects.form.screenshotLimit"));
    if (!selected.every((file) => validFile("screenshot", file))) return;
    setUploading(true);
    let next = [...screenshots];
    try {
      for (const file of selected) {
        const result = await uploadProjectMedia(projectId, "screenshot", file);
        onUploadPath?.(result.path);
        next = [...next, { path: result.path, url: result.signed_url }];
        onScreenshotsChange(next);
      }
    } catch (error) {
      toast.error(projectErrorMessage(error, t));
    } finally {
      setUploading(false);
    }
  }

  async function remove(item: ProjectMediaItem, kind: "logo" | "screenshot") {
    if (kind === "logo") onLogoChange(null);
    else onScreenshotsChange(screenshots.filter((current) => current.path !== item.path));
    if (!deleteOnRemove) {
      onRemovePath?.(item.path);
      return;
    }
    try {
      await deleteProjectMedia(projectId, item.path);
    } catch {
      toast.error(t("projects.form.mediaDeleteFailed"));
    }
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= screenshots.length) return;
    const next = [...screenshots];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onScreenshotsChange(next);
  }

  if (presentation === "submission") {
    return <div className="space-y-8">
      <section className="grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12" aria-labelledby="project-logo-label">
        <div className="min-w-0 space-y-4">
          <div>
            <h3 id="project-logo-label" className="text-heading-medium font-display text-neutral-200">{t("projects.form.logo")}</h3>
            <p className="mt-4 text-xs leading-[1.25] tracking-[0.24px] font-body text-neutral-400">{t("projects.form.submissionLogoHint")}</p>
          </div>
          <input ref={logoInput} hidden type="file" accept={ACCEPT} disabled={uploading} aria-label={t("projects.form.chooseLogo")} onChange={event => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} />
          <Button type="button" size="xsmall" variant="cta" hierarchy="secondary" disabled={uploading} onClick={() => logoInput.current?.click()}>{t("projects.form.uploadLogo")}</Button>
        </div>
        <div className="flex items-start gap-3">
          {logo ? <div className="relative size-[120px] rounded-md">
            <img src={logo.url} alt="" className="size-full rounded-md object-cover" />
            <Button type="button" size="xsmall" variant="cta" hierarchy="tertiary" iconOnly className="absolute -right-1 -top-1 size-4 rounded-full border border-border bg-background p-0" aria-label={t("projects.form.remove")} disabled={uploading} onClick={() => void remove(logo, "logo")}><X className="size-2" weight="duotone" aria-hidden /></Button>
          </div> : <DashedUploadSlot
            className="size-[120px]"
            label={t("projects.form.uploadLogo")}
            disabled={uploading}
            onClick={() => logoInput.current?.click()}
            onDropFiles={files => { void uploadLogo(files[0]); }}
          />}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12" aria-labelledby="project-preview-images-label">
        <div className="min-w-0 space-y-4">
          <div>
            <h3 id="project-preview-images-label" className="text-heading-medium font-display text-foreground-subtle">{t("projects.editor.submissionPreviewImages")}</h3>
            <p className="mt-2 text-body-small font-body text-foreground-muted">{t("projects.form.screenshotsHint")}</p>
          </div>
          <input ref={screenshotsInput} hidden type="file" accept={ACCEPT} multiple disabled={uploading || screenshots.length >= 6} aria-label={t("projects.form.addScreenshots")} onChange={event => { void uploadScreenshots(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={uploading || screenshots.length >= 6} onClick={() => screenshotsInput.current?.click()}>{t("projects.form.addScreenshots")}</Button>
        </div>
        <div className="flex min-w-0 flex-wrap items-start gap-3">
          {screenshots.map((item, index) => (
            <div key={item.path} className="w-[210px] overflow-hidden rounded-md border border-border bg-surface-raised">
              <img src={item.url} alt={t("projects.form.screenshotAlt", { index: index + 1 })} className="h-[120px] w-full object-cover" />
              <div className="flex justify-end gap-1 p-1">
                <Button type="button" size="small" variant="cta" hierarchy="tertiary" iconOnly aria-label={t("projects.form.moveUp")} disabled={uploading || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                <Button type="button" size="small" variant="cta" hierarchy="tertiary" iconOnly aria-label={t("projects.form.moveDown")} disabled={uploading || index === screenshots.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                <Button type="button" size="small" variant="cta" hierarchy="tertiary" iconOnly aria-label={t("projects.form.remove")} disabled={uploading} onClick={() => void remove(item, "screenshot")}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
          {screenshots.length < 6 ? <DashedUploadSlot
            className="h-[120px] w-[210px]"
            label={t("projects.form.addScreenshots")}
            disabled={uploading}
            onClick={() => screenshotsInput.current?.click()}
            onDropFiles={files => { void uploadScreenshots(files); }}
          /> : null}
          {uploading ? <p className="basis-full text-body-small font-body text-foreground-muted" role="status">{t("projects.editor.uploading")}</p> : null}
        </div>
      </section>
    </div>;
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-label-medium font-body">{t("projects.form.logo")}</legend>
        <p className="mt-1 text-body-small font-body text-foreground-muted">{t("projects.form.logoHint")}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
            {logo ? <img src={logo.url} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="size-7 text-foreground-subtle" aria-hidden />}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={logoInput} hidden type="file" accept={ACCEPT} disabled={uploading} aria-label={t("projects.form.chooseLogo")} onChange={event => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} />
            <Button type="button" variant="cta" hierarchy="secondary" disabled={uploading} onClick={() => logoInput.current?.click()}>{t("projects.form.chooseLogo")}</Button>
            {logo ? <Button type="button" variant="cta" hierarchy="tertiary" disabled={uploading} onClick={() => void remove(logo, "logo")}><Trash2 className="size-4" />{t("projects.form.remove")}</Button> : null}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-label-medium font-body">{t("projects.form.screenshots")}</legend>
        <p className="mt-1 text-body-small font-body text-foreground-muted">{t("projects.form.screenshotsHint")}</p>
        <input ref={screenshotsInput} hidden type="file" accept={ACCEPT} multiple disabled={uploading || screenshots.length >= 6} aria-label={t("projects.form.addScreenshots")} onChange={event => { void uploadScreenshots(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <Button className="mt-3" type="button" variant="cta" hierarchy="secondary" disabled={uploading || screenshots.length >= 6} onClick={() => screenshotsInput.current?.click()}><ImagePlus className="size-4" />{t("projects.form.addScreenshots")}</Button>
        {uploading ? <p className="mt-3 text-body-medium font-body text-foreground-muted" role="status">{t("projects.editor.uploading")}</p> : null}
        {screenshots.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {screenshots.map((item, index) => (
              <div key={item.path} className="overflow-hidden rounded-lg border border-border bg-surface-raised">
                <img src={item.url} alt={t("projects.form.screenshotAlt", { index: index + 1 })} className="aspect-video w-full object-cover" />
                <div className="flex justify-end gap-1 p-2">
                  <Button type="button" size="small" variant="cta" hierarchy="tertiary" iconOnly aria-label={t("projects.form.moveUp")} disabled={uploading || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                  <Button type="button" size="small" variant="cta" hierarchy="tertiary" iconOnly aria-label={t("projects.form.moveDown")} disabled={uploading || index === screenshots.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                  <Button type="button" size="small" variant="cta" hierarchy="tertiary" iconOnly aria-label={t("projects.form.remove")} disabled={uploading} onClick={() => void remove(item, "screenshot")}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
