import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { Plus, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

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
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-project-media-upload-placeholder-surface transition-colors ${!disabled ? "hover:bg-action-hover" : ""} ${dragOver ? "ring-2 ring-inset ring-primary" : ""} ${className}`}
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
        <Plus className="size-4 text-project-editor-heading" weight="regular" aria-hidden />
      </Button>
    </div>
  );
}

type SortableScreenshotsGridProps = {
  screenshots: ProjectMediaItem[];
  onScreenshotsChange: (screenshots: ProjectMediaItem[]) => void;
  onRemove: (item: ProjectMediaItem) => void;
  uploading: boolean;
  t: TFunction<"common">;
  trailingSlot?: ReactNode;
};

function lockPageScroll() {
  const body = document.body;
  const root = document.documentElement;
  const previousOverflow = body.style.overflow;
  const previousPaddingRight = body.style.paddingRight;
  const previousOverscrollBehavior = root.style.overscrollBehavior;
  const scrollbarWidth = window.innerWidth - root.clientWidth;

  if (scrollbarWidth > 0) {
    body.style.paddingRight = `calc(${window.getComputedStyle(body).paddingRight} + ${scrollbarWidth}px)`;
  }
  body.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";

  return () => {
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
    root.style.overscrollBehavior = previousOverscrollBehavior;
  };
}

function preventTouchScroll(event: TouchEvent) {
  event.preventDefault();
}

function SortableScreenshotsGrid({
  screenshots,
  onScreenshotsChange,
  onRemove,
  uploading,
  t,
  trailingSlot,
}: SortableScreenshotsGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [pointerCoord, setPointerCoord] = useState<{ x: number; y: number } | null>(null);
  const [grabOffset, setGrabOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const draggingIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const screenshotsRef = useRef(screenshots);
  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingActiveRef = useRef(false);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const cleanupPendingPointerRef = useRef<(() => void) | null>(null);

  // Compute preview reordered list for rendering in the grid while dragging
  const displayItems = useMemo(() => {
    if (draggingIndex === null || overIndex === null || draggingIndex === overIndex) {
      return screenshots;
    }
    const next = [...screenshots];
    const [moved] = next.splice(draggingIndex, 1);
    if (moved) {
      next.splice(overIndex, 0, moved);
    }
    return next;
  }, [screenshots, draggingIndex, overIndex]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      cleanupPendingPointerRef.current?.();
      cleanupDragRef.current?.();
    };
  }, []);

  function startDrag(clientX: number, clientY: number, index: number, cardEl: HTMLElement, pointerId: number) {
    cleanupPendingPointerRef.current?.();
    const restorePageScroll = lockPageScroll();
    const rect = cardEl.getBoundingClientRect();
    setGrabOffset({ x: clientX - rect.left, y: clientY - rect.top });
    setPointerCoord({ x: clientX, y: clientY });
    setDraggingIndex(index);
    setOverIndex(index);
    draggingIndexRef.current = index;
    overIndexRef.current = index;
    isDraggingActiveRef.current = true;

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        /* ignore */
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      setPointerCoord({ x: e.clientX, y: e.clientY });

      const grid = gridRef.current;
      if (!grid) return;

      const cards = Array.from(grid.querySelectorAll<HTMLDivElement>("[data-sortable-card]"));
      let targetIndex: number | null = null;

      for (let i = 0; i < cards.length; i++) {
        const r = cards[i]!.getBoundingClientRect();
        if (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        ) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex !== null && targetIndex !== overIndexRef.current) {
        // Capture positions of all grid cards before state change
        const state = Flip.getState(grid.querySelectorAll("[data-sortable-card]"));

        overIndexRef.current = targetIndex;
        setOverIndex(targetIndex);

        // Animate all other shifting cards smoothly to make room
        requestAnimationFrame(() => {
          Flip.from(state, {
            duration: 0.28,
            ease: "power2.out",
            targets: grid.querySelectorAll("[data-sortable-card]"),
          });
        });
      }
    }

    function cleanupDrag() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("touchmove", preventTouchScroll);
      restorePageScroll();
      isDraggingActiveRef.current = false;
      cleanupDragRef.current = null;
    }

    function finishDrag(commit: boolean) {
      cleanupDrag();

      const fromIndex = draggingIndexRef.current;
      const toIndex = overIndexRef.current;

      if (commit && fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
        const next = [...screenshotsRef.current];
        const [moved] = next.splice(fromIndex, 1);
        if (moved) {
          next.splice(toIndex, 0, moved);
          onScreenshotsChange(next);
        }
      }

      setDraggingIndex(null);
      setOverIndex(null);
      setPointerCoord(null);
      draggingIndexRef.current = null;
      overIndexRef.current = null;
      isDraggingActiveRef.current = false;
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId === pointerId) finishDrag(true);
    }

    function onPointerCancel(e: PointerEvent) {
      if (e.pointerId === pointerId) finishDrag(false);
    }

    function onWindowBlur() {
      finishDrag(false);
    }

    cleanupDragRef.current = cleanupDrag;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("touchmove", preventTouchScroll, { passive: false });
  }

  function handleCardPointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (uploading) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    const targetEl = e.currentTarget;
    if (typeof targetEl.setPointerCapture === "function") {
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch {
        // The pointer may already have been canceled by the browser.
      }
    }

    if (e.pointerType === "touch") {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        pointerStartRef.current = null;
        startDrag(e.clientX, e.clientY, index, targetEl, e.pointerId);
      }, 250);
    } else {
      function onInitialMouseMove(moveEvent: PointerEvent) {
        if (!pointerStartRef.current || moveEvent.pointerId !== e.pointerId) return;
        const dx = Math.abs(moveEvent.clientX - pointerStartRef.current.x);
        const dy = Math.abs(moveEvent.clientY - pointerStartRef.current.y);
        if (dx > 4 || dy > 4) {
          cleanupInitialPointer();
          startDrag(moveEvent.clientX, moveEvent.clientY, index, targetEl, e.pointerId);
        }
      }

      function cleanupInitialPointer() {
        window.removeEventListener("pointermove", onInitialMouseMove);
        window.removeEventListener("pointerup", onInitialMouseUp);
        window.removeEventListener("pointercancel", onInitialPointerCancel);
        window.removeEventListener("blur", onInitialWindowBlur);
        pointerStartRef.current = null;
        cleanupPendingPointerRef.current = null;
      }

      function onInitialMouseUp(upEvent: PointerEvent) {
        if (upEvent.pointerId === e.pointerId) cleanupInitialPointer();
      }

      function onInitialPointerCancel(cancelEvent: PointerEvent) {
        if (cancelEvent.pointerId === e.pointerId) cleanupInitialPointer();
      }

      function onInitialWindowBlur() {
        cleanupInitialPointer();
      }

      cleanupPendingPointerRef.current = cleanupInitialPointer;
      window.addEventListener("pointermove", onInitialMouseMove);
      window.addEventListener("pointerup", onInitialMouseUp);
      window.addEventListener("pointercancel", onInitialPointerCancel);
      window.addEventListener("blur", onInitialWindowBlur);
    }
  }

  function handleCardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    if (!pointerStartRef.current || isDraggingActiveRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 8 || dy > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      pointerStartRef.current = null;
    }
  }

  function handleCardPointerUp() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  }

  return (
    <>
      <div ref={gridRef} className="flex min-w-0 flex-wrap items-start gap-3">
        {displayItems.map((item, index) => {
          const isBeingDragged = draggingIndex !== null && item.path === screenshots[draggingIndex]?.path;

          return (
            <div
              key={item.path}
              data-sortable-card
              className={`group relative h-[120px] w-[210px] shrink-0 touch-pan-y select-none rounded-md transition-shadow duration-150 ${
                isBeingDragged
                  ? "border-2 border-dashed border-primary/50 bg-primary/5 opacity-40 shadow-inner"
                  : "cursor-grab active:cursor-grabbing hover:shadow-md"
              }`}
              onPointerDown={(e) => handleCardPointerDown(e, index)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerUp}
              onPointerCancel={handleCardPointerUp}
            >
              <img
                src={item.url}
                alt={t("projects.form.screenshotAlt", { index: index + 1 })}
                className="pointer-events-none size-full rounded-md object-cover"
                draggable={false}
              />
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <GripVertical className="size-3" />
                {index === 0 ? t("projects.form.coverImageBadge", "Bìa") : `#${index + 1}`}
              </span>
              <Button
                type="button"
                size="xsmall"
                variant="cta"
                hierarchy="tertiary"
                iconOnly
                className="absolute -right-1.5 -top-1.5 z-10 size-4 rounded-full border border-border bg-surface-raised p-0 text-foreground"
                aria-label={t("projects.form.remove")}
                disabled={uploading}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
              >
                <X className="size-2.5" weight="regular" aria-hidden />
              </Button>
            </div>
          );
        })}
        {trailingSlot}
      </div>

      {typeof document !== "undefined" && draggingIndex !== null && pointerCoord && screenshots[draggingIndex]
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 overflow-hidden rounded-md shadow-2xl ring-2 ring-primary scale-105"
              style={{
                left: pointerCoord.x - grabOffset.x,
                top: pointerCoord.y - grabOffset.y,
                width: 210,
                height: 120,
              }}
            >
              <img
                src={screenshots[draggingIndex].url}
                alt=""
                className="size-full object-cover"
                draggable={false}
              />
              <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                <GripVertical className="size-3" />
                {overIndex === 0 ? t("projects.form.coverImageBadge", "Bìa") : `#${(overIndex ?? draggingIndex) + 1}`}
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
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
      <section className="grid min-w-0 gap-6 xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-x-12" aria-labelledby="project-logo-label">
        <div className="min-w-0 space-y-4">
          <div>
            <h3 id="project-logo-label" className="text-heading-medium font-display text-project-editor-heading">{t("projects.form.logo")} <span className="text-label-medium text-error-400">*</span></h3>
            <p className="mt-4 text-xs leading-[1.25] tracking-[0.24px] font-body text-foreground-subtle">{t("projects.form.submissionLogoHint")}</p>
          </div>
          <input ref={logoInput} hidden type="file" accept={ACCEPT} disabled={uploading} aria-label={t("projects.form.chooseLogo")} onChange={event => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} />
          <Button type="button" size="xsmall" variant="cta" hierarchy="secondary" disabled={uploading} onClick={() => logoInput.current?.click()}>{t("projects.form.uploadLogo")}</Button>
        </div>
        <div className="flex items-start gap-3">
          {logo ? <div className="relative size-[120px] rounded-md">
            <img src={logo.url} alt="" className="size-full rounded-md object-cover" />
            <Button type="button" size="xsmall" variant="cta" hierarchy="tertiary" iconOnly className="absolute -right-1.5 -top-1.5 size-4 rounded-full border border-border bg-surface-raised p-0 text-foreground" aria-label={t("projects.form.remove")} disabled={uploading} onClick={() => void remove(logo, "logo")}><X className="size-2.5" weight="regular" aria-hidden /></Button>
          </div> : <DashedUploadSlot
            className="size-[120px]"
            label={t("projects.form.uploadLogo")}
            disabled={uploading}
            onClick={() => logoInput.current?.click()}
            onDropFiles={files => { void uploadLogo(files[0]); }}
          />}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-x-12" aria-labelledby="project-preview-images-label">
        <div className="min-w-0 space-y-4">
          <div>
            <h3 id="project-preview-images-label" className="text-heading-medium font-display text-project-editor-heading">{t("projects.editor.submissionPreviewImages")}</h3>
            <p className="mt-4 text-body-small font-body text-foreground-subtle">{t("projects.form.screenshotsHint")}</p>
          </div>
          <input ref={screenshotsInput} hidden type="file" accept={ACCEPT} multiple disabled={uploading || screenshots.length >= 6} aria-label={t("projects.form.addScreenshots")} onChange={event => { void uploadScreenshots(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <Button type="button" size="xsmall" variant="cta" hierarchy="secondary" disabled={uploading || screenshots.length >= 6} onClick={() => screenshotsInput.current?.click()}>{t("projects.form.uploadLogo")}</Button>
        </div>
        <div className="min-w-0">
          <SortableScreenshotsGrid
            screenshots={screenshots}
            onScreenshotsChange={onScreenshotsChange}
            onRemove={(item) => void remove(item, "screenshot")}
            uploading={uploading}
            t={t}
            trailingSlot={
              screenshots.length < 6 ? (
                <DashedUploadSlot
                  className="h-[120px] w-[210px]"
                  label={t("projects.form.addScreenshots")}
                  disabled={uploading}
                  onClick={() => screenshotsInput.current?.click()}
                  onDropFiles={(files) => { void uploadScreenshots(files); }}
                />
              ) : null
            }
          />
          {uploading ? <p className="mt-3 text-body-small font-body text-foreground-muted" role="status">{t("projects.editor.uploading")}</p> : null}
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
