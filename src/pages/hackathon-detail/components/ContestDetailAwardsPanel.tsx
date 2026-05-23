import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Plus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

const TEXTAREA_CLASS =
  "min-h-[88px] w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";
import {
  countIssuancesForTemplate,
  listHackathonCredentialTemplates,
  saveHackathonCredentialTemplate,
  type CredentialTemplateRow,
} from "@/lib/credentialTemplates";
import { invokeGrantCredentials } from "@/lib/credentialsEdge";
import { uploadHackathonCredentialBadgeImage } from "@/lib/storage";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

type SubTab = "templates" | "grant";

const ROLES = ["winner", "finalist", "participant", "custom"] as const;

export function ContestDetailAwardsPanel({ vm }: { vm: ContestDetailViewModel }) {
  const { contest, translate } = vm;
  const [tab, setTab] = useState<SubTab>("templates");
  const [templates, setTemplates] = useState<CredentialTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<CredentialTemplateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formRole, setFormRole] = useState<(typeof ROLES)[number]>("winner");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formPrefix, setFormPrefix] = useState("");
  const [formActive, setFormActive] = useState(true);

  const [grantTemplateId, setGrantTemplateId] = useState("");
  const [grantUserIds, setGrantUserIds] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listHackathonCredentialTemplates(contest.id);
      setTemplates(rows);
      const next: Record<string, number> = {};
      await Promise.all(
        rows.map(async (r) => {
          next[r.id] = await countIssuancesForTemplate(r.id).catch(() => 0);
        }),
      );
      setCounts(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [contest.id, translate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setGrantTemplateId((prev) => {
      if (prev) return prev;
      const active = templates.find((r) => r.is_active);
      const pick = active?.id ?? templates[0]?.id ?? "";
      return pick;
    });
  }, [templates]);

  const openCreate = () => {
    setEditRow(null);
    setFormRole("winner");
    setFormName("");
    setFormDescription("");
    setFormImageUrl("");
    const slug = (contest.slug ?? contest.id).toString();
    setFormPrefix(`corelia:${slug}:winner`.slice(0, 40));
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (row: CredentialTemplateRow) => {
    setEditRow(row);
    setFormRole((row.hackathon_role as (typeof ROLES)[number]) ?? "winner");
    setFormName(row.name);
    setFormDescription(row.description);
    setFormImageUrl(row.image_url);
    setFormPrefix(row.identifier_prefix);
    setFormActive(row.is_active);
    setDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await saveHackathonCredentialTemplate({
        hackathonId: contest.id,
        hackathonSlug: contest.slug ?? contest.id,
        templateId: editRow?.id ?? null,
        hackathonRole: formRole === "custom" ? "custom" : formRole,
        isActive: formActive,
        name: formName,
        description: formDescription,
        imageUrl: formImageUrl,
        identifierPrefix: formPrefix,
      });
      toast.success(translate("workspace.awards.saved"));
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleGrant = async () => {
    const ids = grantUserIds
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!grantTemplateId || ids.length === 0) {
      toast.error(translate("workspace.awards.grantNeedInputs"));
      return;
    }
    setGranting(true);
    try {
      const res = await invokeGrantCredentials({
        templateId: grantTemplateId,
        userIds: ids,
        grantedReason: grantReason.trim() || null,
      });
      if (res.errors?.length) {
        toast.message(res.errors.join("\n"));
      }
      toast.success(translate("workspace.awards.grantOk"));
      setGrantUserIds("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.grantFailed"));
    } finally {
      setGranting(false);
    }
  };

  const slugLabel = (contest.slug ?? contest.id).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
        <Button type="button" variant={tab === "templates" ? "secondary" : "ghost"} onClick={() => setTab("templates")}>
          {translate("workspace.awards.tabTemplates")}
        </Button>
        <Button type="button" variant={tab === "grant" ? "secondary" : "ghost"} onClick={() => setTab("grant")}>
          {translate("workspace.awards.tabGrant")}
        </Button>
      </div>

      {tab === "templates" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 size-4" aria-hidden />
              {translate("workspace.awards.addTemplate")}
            </Button>
          </div>
          {loading ? (
            <div
              className="overflow-hidden rounded-md border border-border-subtle"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-3 border-b border-border-subtle bg-surface-raised px-3 py-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-4 w-full" />
                ))}
              </div>
              <div className="divide-y divide-border-subtle">
                {Array.from({ length: 4 }).map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-3 px-3 py-3"
                  >
                    {Array.from({ length: 5 }).map((_, cellIdx) => (
                      <Skeleton key={cellIdx} className="h-5 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-foreground-muted">{translate("workspace.awards.noTemplates")}</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border-subtle">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-raised">
                  <tr>
                    <th className="px-3 py-2">{translate("workspace.awards.colRole")}</th>
                    <th className="px-3 py-2">{translate("workspace.awards.colName")}</th>
                    <th className="px-3 py-2">{translate("workspace.awards.colIssued")}</th>
                    <th className="px-3 py-2">{translate("workspace.awards.colActive")}</th>
                    <th className="px-3 py-2 text-right">{translate("workspace.awards.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((trow) => (
                    <tr key={trow.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{trow.hackathon_role}</td>
                      <td className="px-3 py-2">{trow.name}</td>
                      <td className="px-3 py-2">{counts[trow.id] ?? 0}</td>
                      <td className="px-3 py-2">{trow.is_active ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(trow)}>
                          {translate("workspace.awards.edit")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-xl space-y-4">
          <Field>
            <FieldLabel>{translate("workspace.awards.grantTemplateLabel")}</FieldLabel>
            <select
              className="flex h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
              value={grantTemplateId}
              onChange={(e) => setGrantTemplateId(e.target.value)}
            >
              {templates.filter((x) => x.is_active).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.hackathon_role} — {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel>{translate("workspace.awards.grantUsersLabel")}</FieldLabel>
            <textarea
              rows={4}
              placeholder="uuid1, uuid2..."
              value={grantUserIds}
              className={TEXTAREA_CLASS}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGrantUserIds(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{translate("workspace.awards.grantReasonLabel")}</FieldLabel>
            <textarea
              rows={2}
              value={grantReason}
              className={TEXTAREA_CLASS}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGrantReason(e.target.value)}
            />
          </Field>
          <Button type="button" disabled={granting} onClick={() => void handleGrant()}>
            {granting ? translate("workspace.awards.granting") : translate("workspace.awards.grantCta")}
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editRow ? translate("workspace.awards.editTitle") : translate("workspace.awards.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field>
              <FieldLabel>{translate("workspace.awards.fieldRole")}</FieldLabel>
              <select
                className="flex h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
                value={formRole}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setFormRole(e.target.value as (typeof ROLES)[number])
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>{translate("workspace.awards.fieldName")}</FieldLabel>
              <Input value={formName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{translate("workspace.awards.fieldDescription")}</FieldLabel>
              <textarea
                rows={3}
                value={formDescription}
                className={TEXTAREA_CLASS}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{translate("workspace.awards.fieldImage")}</FieldLabel>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                disabled={uploading}
                onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const { url } = await uploadHackathonCredentialBadgeImage(contest.id, file);
                    setFormImageUrl(url);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              {formImageUrl ? (
                <img src={formImageUrl} alt="" className="mt-2 h-16 rounded border border-border-subtle" />
              ) : null}
            </Field>
            <Field>
              <FieldLabel>{translate("workspace.awards.fieldPrefix")}</FieldLabel>
              <Input
                value={formPrefix}
                maxLength={40}
                onChange={(e) => setFormPrefix(e.target.value)}
                placeholder={`corelia:${slugLabel}:winner`}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
              {translate("workspace.awards.fieldActive")}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {translate("workspace.awards.cancel")}
            </Button>
            <Button type="button" disabled={saving || !formName.trim() || !formImageUrl.trim()} onClick={() => void handleSaveTemplate()}>
              {saving ? translate("workspace.awards.saving") : translate("workspace.awards.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
