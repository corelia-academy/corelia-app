import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const TEXTAREA_CLASS =
  "min-h-[88px] w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";
import {
  countIssuancesForTemplate,
  listActivityMilestoneTemplates,
  saveActivityMilestoneTemplate,
  type CredentialTemplateRow,
} from "@/lib/credentialTemplates";
import { uploadActivityMilestoneBadgeImage } from "@/lib/storage";
import { validatePngSignature } from "@/lib/imageValidation";

type MilestoneEventKey =
  | "login_streak"
  | "courses_completed"
  | "courses_completed_in_track"
  | "projects_submitted";

function buildTriggerRule(
  event: MilestoneEventKey,
  days: number,
  count: number,
  track: string,
): Record<string, unknown> | null {
  switch (event) {
    case "login_streak":
      return { event: "login_streak", days };
    case "courses_completed":
      return { event: "courses_completed", count };
    case "courses_completed_in_track":
      return { event: "courses_completed_in_track", track: track.trim(), count };
    case "projects_submitted":
      return { event: "projects_submitted", count };
    default:
      return { event: "courses_completed", count: 1 };
  }
}

export default function AdminActivityMilestones() {
  const { t } = useTranslation("admin");
  const [rows, setRows] = useState<CredentialTemplateRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [identifierPrefix, setIdentifierPrefix] = useState("");
  const [eventKey, setEventKey] = useState<MilestoneEventKey>("courses_completed");
  const [days, setDays] = useState(7);
  const [count, setCount] = useState(5);
  const [track, setTrack] = useState("ai");
  const [isActive, setIsActive] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listActivityMilestoneTemplates();
      // One-off manual OCA/OCB grants (Admin Manual Mint tab) reuse this same
      // scope+table but aren't recurring milestones — keep them off this list.
      const milestonesOnly = list.filter((r) => r.trigger_type !== "manual");
      setRows(milestonesOnly);
      const next: Record<string, number> = {};
      await Promise.all(
        list.map(async (r) => {
          next[r.id] = await countIssuancesForTemplate(r.id).catch(() => 0);
        }),
      );
      setCounts(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("activityMilestones.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await uploadActivityMilestoneBadgeImage(file);
      setImageUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onFileSelect = async (file: File | null) => {
    if (!file) return;

    const isPng = await validatePngSignature(file);
    if (!isPng) {
      toast.error(
        <span>
          Định dạng file không phải PNG. Vui lòng tách nền hoặc chuyển đổi ảnh tại{" "}
          <a href="https://www.remove.bg" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-primary-foreground hover:opacity-85">
            remove.bg
          </a>
        </span>
      );
      return;
    }

    await handleUpload(file);
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function describeRule(row: CredentialTemplateRow): string {
    const rule = row.trigger_rule as Record<string, unknown> | null;
    if (!rule) return "—";
    if (rule.manual === true) return t("activityMilestones.rule.manual");
    const ev = String(rule.event ?? "");
    if (ev === "login_streak") {
      return t("activityMilestones.rule.loginStreak", { days: Number(rule.days ?? 0) });
    }
    if (ev === "courses_completed") {
      return t("activityMilestones.rule.coursesCompleted", { count: Number(rule.count ?? 0) });
    }
    if (ev === "courses_completed_in_track") {
      return t("activityMilestones.rule.trackCourses", {
        track: String(rule.track ?? ""),
        count: Number(rule.count ?? 0),
      });
    }
    if (ev === "projects_submitted") {
      return t("activityMilestones.rule.projects", { count: Number(rule.count ?? 0) });
    }
    return JSON.stringify(rule);
  }

  const openCreate = () => {
    setEditId(null);
    setName("");
    setDescription("");
    setImageUrl("");
    setIdentifierPrefix("");
    setEventKey("courses_completed");
    setDays(7);
    setCount(5);
    setTrack("ai");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (row: CredentialTemplateRow) => {
    setEditId(row.id);
    setName(row.name);
    setDescription(row.description);
    setImageUrl(row.image_url);
    setIdentifierPrefix(row.identifier_prefix);
    const rule = row.trigger_rule as Record<string, unknown> | null;
    const ev = String(rule?.event ?? "courses_completed") as MilestoneEventKey;
    if (
      ev === "login_streak" ||
      ev === "courses_completed" ||
      ev === "courses_completed_in_track" ||
      ev === "projects_submitted"
    ) {
      setEventKey(ev);
    } else {
      setEventKey("courses_completed");
    }
    setDays(Number(rule?.days ?? 7));
    setCount(Number(rule?.count ?? 5));
    setTrack(String(rule?.track ?? "ai"));
    setIsActive(row.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const triggerRule = buildTriggerRule(eventKey, days, count, track);
      await saveActivityMilestoneTemplate({
        templateId: editId,
        isActive,
        name,
        description,
        imageUrl,
        identifierPrefix: identifierPrefix.trim() || `corelia:milestone-${Date.now()}`.slice(0, 40),
        triggerType: "auto",
        triggerRule,
      });
      toast.success(t("activityMilestones.saved"));
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("activityMilestones.saveFailed"));
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("activityMilestones.heading")}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t("activityMilestones.subheading")}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 size-4" aria-hidden />
          {t("activityMilestones.add")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("activityMilestones.loading")}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("activityMilestones.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-subtle">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-surface-raised">
              <tr>
                <th className="px-3 py-2">{t("activityMilestones.col.name")}</th>
                <th className="px-3 py-2">{t("activityMilestones.col.rule")}</th>
                <th className="px-3 py-2">{t("activityMilestones.col.trigger")}</th>
                <th className="px-3 py-2">{t("activityMilestones.col.issued")}</th>
                <th className="px-3 py-2">{t("activityMilestones.col.active")}</th>
                <th className="px-3 py-2 text-right">{t("activityMilestones.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-foreground-muted">{describeRule(r)}</td>
                  <td className="px-3 py-2">{r.trigger_type}</td>
                  <td className="px-3 py-2">{counts[r.id] ?? 0}</td>
                  <td className="px-3 py-2">{r.is_active ? "✓" : "—"}</td>
                  <td className="space-x-2 px-3 py-2 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(r)}>
                      {t("activityMilestones.edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t("activityMilestones.editTitle") : t("activityMilestones.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field>
              <FieldLabel>{t("activityMilestones.field.name")}</FieldLabel>
              <Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t("activityMilestones.field.description")}</FieldLabel>
              <textarea
                rows={3}
                value={description}
                className={TEXTAREA_CLASS}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("activityMilestones.field.image")}</FieldLabel>
              <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border-subtle bg-surface-base p-6 text-center transition-colors hover:bg-surface-raised focus-within:border-primary">
                <input
                  type="file"
                  accept="image/png"
                  disabled={uploading}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => void onFileSelect(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-col items-center gap-2 text-sm text-foreground-muted">
                  {uploading ? (
                    <>
                      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                      <span className="font-medium text-primary">
                        {t("layout.activityMilestones.uploading")}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="rounded-full bg-surface-raised p-3">
                        <Upload className="size-5" aria-hidden />
                      </div>
                      <div>
                        <span className="font-medium text-primary">
                          {t("layout.activityMilestones.clickToUpload")}
                        </span>{" "}
                        {t("layout.activityMilestones.orDragDrop")}
                      </div>
                      <div className="text-xs opacity-70">
                        {t("layout.activityMilestones.supportFormats")}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {imageUrl ? (
                <div className="mt-3 overflow-hidden rounded-md border border-border-subtle bg-surface-raised p-2 relative">
                  <div className="flex items-center justify-between gap-2 mb-2 text-xs font-medium text-foreground-muted">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-4" />
                      {t("layout.activityMilestones.preview")}
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <span className="text-[10px] font-bold">×</span>
                    </button>
                  </div>
                  <img src={imageUrl} alt="Badge Preview" className="h-32 w-full object-contain" />
                </div>
              ) : null}
            </Field>
            <Field>
              <FieldLabel>{t("activityMilestones.field.prefix")}</FieldLabel>
              <Input
                value={identifierPrefix}
                maxLength={40}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIdentifierPrefix(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("activityMilestones.field.event")}</FieldLabel>
              <select
                className="flex h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
                value={eventKey}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setEventKey(e.target.value as MilestoneEventKey)
                }
              >
                <option value="login_streak">{t("activityMilestones.event.loginStreak")}</option>
                <option value="courses_completed">{t("activityMilestones.event.coursesCompleted")}</option>
                <option value="courses_completed_in_track">{t("activityMilestones.event.trackCourses")}</option>
                <option value="projects_submitted">{t("activityMilestones.event.projects")}</option>
              </select>
            </Field>
            {eventKey === "login_streak" ? (
              <Field>
                <FieldLabel>{t("activityMilestones.field.days")}</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDays(Number(e.target.value))}
                />
              </Field>
            ) : null}
            {eventKey === "courses_completed" || eventKey === "projects_submitted" ? (
              <Field>
                <FieldLabel>{t("activityMilestones.field.count")}</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCount(Number(e.target.value))}
                />
              </Field>
            ) : null}
            {eventKey === "courses_completed_in_track" ? (
              <>
                <Field>
                  <FieldLabel>{t("activityMilestones.field.track")}</FieldLabel>
                  <Input
                    value={track}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTrack(e.target.value)}
                    placeholder="ai | app | blockchain"
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("activityMilestones.field.count")}</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCount(Number(e.target.value))}
                  />
                </Field>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
              />
              {t("activityMilestones.field.active")}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("activityMilestones.cancel")}
            </Button>
            <Button type="button" disabled={saving || !name.trim() || !imageUrl.trim()} onClick={() => void handleSave()}>
              {saving ? t("activityMilestones.saving") : t("activityMilestones.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
