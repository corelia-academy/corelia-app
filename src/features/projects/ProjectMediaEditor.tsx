import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
};

const ACCEPT = "image/png,image/jpeg,image/webp";

export function ProjectMediaEditor({
  projectId,
  logo,
  screenshots,
  onLogoChange,
  onScreenshotsChange,
  deleteOnRemove = true,
  onRemovePath,
  onUploadPath,
}: Props) {
  const { t } = useTranslation("common");
  const [uploading, setUploading] = useState(false);

  function validFile(kind: "logo" | "screenshot", file: File): boolean {
    const max = kind === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!ACCEPT.split(",").includes(file.type) || file.size > max) {
      toast.error(t(kind === "logo" ? "projects.form.logoInvalid" : "projects.form.screenshotInvalid"));
      return false;
    }
    return true;
  }

  async function uploadLogo(file: File | undefined) {
    if (!file || !validFile("logo", file)) return;
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
      toast.error(error instanceof Error ? error.message : t("projects.form.mediaUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function uploadScreenshots(files: File[]) {
    if (!files.length) return;
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
      toast.error(error instanceof Error ? error.message : t("projects.form.mediaUploadFailed"));
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

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium">{t("projects.form.logo")}</legend>
        <p className="mt-1 text-xs text-foreground-muted">{t("projects.form.logoHint")}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
            {logo ? <img src={logo.url} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="size-7 text-foreground-subtle" aria-hidden />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={uploading} render={<label />} nativeButton={false}>
              <input className="sr-only" type="file" accept={ACCEPT} onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} />
              {t("projects.form.chooseLogo")}
            </Button>
            {logo ? <Button type="button" variant="ghost" onClick={() => void remove(logo, "logo")}><Trash2 className="size-4" />{t("projects.form.remove")}</Button> : null}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">{t("projects.form.screenshots")}</legend>
        <p className="mt-1 text-xs text-foreground-muted">{t("projects.form.screenshotsHint")}</p>
        <Button className="mt-3" type="button" variant="outline" disabled={uploading || screenshots.length >= 6} render={<label />} nativeButton={false}>
          <input className="sr-only" type="file" accept={ACCEPT} multiple onChange={(event) => {
            void uploadScreenshots(Array.from(event.target.files ?? []));
            event.target.value = "";
          }} />
          <ImagePlus className="size-4" />{t("projects.form.addScreenshots")}
        </Button>
        {screenshots.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {screenshots.map((item, index) => (
              <div key={item.path} className="overflow-hidden rounded-lg border border-border bg-surface-raised">
                <img src={item.url} alt={t("projects.form.screenshotAlt", { index: index + 1 })} className="aspect-video w-full object-cover" />
                <div className="flex justify-end gap-1 p-2">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t("projects.form.moveUp")} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t("projects.form.moveDown")} disabled={index === screenshots.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t("projects.form.remove")} onClick={() => void remove(item, "screenshot")}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
