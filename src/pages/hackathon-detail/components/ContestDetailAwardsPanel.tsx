import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
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
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm";

import { saveHackathonCredentialTemplate, type CredentialTemplateRow } from "@/lib/credentialTemplates";
import {
  invokeGrantCredentials,
  type EligibleUser,
} from "@/lib/credentialsEdge";
import { uploadHackathonCredentialBadgeImage } from "@/lib/storage";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import {
  hackathonAwardTemplatesQueryOptions,
  hackathonEligibleUsersQueryOptions,
} from "@/features/hackathons/hackathonAwardQueries";

type SubTab = "templates" | "grant" | "eligibility";

const ROLES = [
  "participant",
  "builder",
  "prototype_submitter",
  "finalist",
  "track_winner",
  "champion",
  "special_award",
  "winner",
  "custom",
] as const;

type CredentialKind = "ocb" | "oca";

const OCB_ACHIEVEMENT_TYPES = ["Badge", "Award"] as const;
const OCA_ACHIEVEMENT_TYPES = ["CertificateOfCompletion", "MicroCredential", "Diploma", "Award"] as const;

function statusLabel(s: EligibleUser["issuanceStatus"], translate: (k: string) => string): string {
  if (s === "minted") return translate("workspace.awards.eligibilityStatusMinted");
  if (s === "pending") return translate("workspace.awards.eligibilityStatusPending");
  if (s === "failed") return translate("workspace.awards.eligibilityStatusFailed");
  return translate("workspace.awards.eligibilityStatusNone");
}

export function ContestDetailAwardsPanel({ vm }: { vm: ContestDetailViewModel }) {
  const { contest, translate, user } = vm;
  const queryClient = useQueryClient();
  const templatesOptions = hackathonAwardTemplatesQueryOptions(
    contest.id,
    user?.id ?? "missing",
  );
  const templatesQuery = useQuery(templatesOptions);
  const templates = templatesQuery.data?.templates ?? [];
  const counts = templatesQuery.data?.counts ?? {};
  const loading = templatesQuery.isPending;
  const [tab, setTab] = useState<SubTab>("templates");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<CredentialTemplateRow | null>(null);

  const [formRole, setFormRole] = useState<(typeof ROLES)[number]>("participant");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formPrefix, setFormPrefix] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formCredentialKind, setFormCredentialKind] = useState<CredentialKind>("ocb");
  const [formAchievementType, setFormAchievementType] = useState("Award");
  const [formTriggerType, setFormTriggerType] = useState<"auto" | "manual">("manual");

  const [grantTemplateId, setGrantTemplateId] = useState("");
  const [grantUserIds, setGrantUserIds] = useState("");
  const [grantReason, setGrantReason] = useState("");

  // Eligibility tab state
  const [eligTemplateId, setEligTemplateId] = useState("");
  const [eligSelected, setEligSelected] = useState<Set<string>>(new Set());
  const defaultTemplateId =
    templates.find((template) => template.is_active)?.id ?? templates[0]?.id ?? "";
  const resolvedGrantTemplateId = grantTemplateId || defaultTemplateId;
  const resolvedEligTemplateId = eligTemplateId || defaultTemplateId;
  const eligibleQuery = useQuery(
    hackathonEligibleUsersQueryOptions(
      contest.id,
      resolvedEligTemplateId,
      user?.id ?? "missing",
    ),
  );
  const eligUsers = eligibleQuery.data ?? null;
  const saveMutation = useMutation({
    mutationFn: saveHackathonCredentialTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesOptions.queryKey }),
  });
  const grantMutation = useMutation({ mutationFn: invokeGrantCredentials });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadHackathonCredentialBadgeImage(contest.id, file),
  });
  const saving = saveMutation.isPending;
  const granting = grantMutation.isPending;
  const eligGranting = grantMutation.isPending;
  const uploading = uploadMutation.isPending;
  const eligLoading = eligibleQuery.isFetching;

  const openCreate = () => {
    setEditRow(null);
    setFormRole("participant");
    setFormName("");
    setFormDescription("");
    setFormImageUrl("");
    const slug = (contest.slug ?? contest.id).toString();
    setFormPrefix(`corelia:${slug}:participant`.slice(0, 40));
    setFormActive(true);
    setFormCredentialKind("ocb");
    setFormAchievementType("Badge");
    setFormTriggerType("manual");
    setDialogOpen(true);
  };

  const openEdit = (row: CredentialTemplateRow) => {
    setEditRow(row);
    setFormRole((row.hackathon_role as (typeof ROLES)[number]) ?? "participant");
    setFormName(row.name);
    setFormDescription(row.description);
    setFormImageUrl(row.image_url);
    setFormPrefix(row.identifier_prefix);
    setFormActive(row.is_active);
    const kind: CredentialKind = row.collection_symbol == null ? "oca" : "ocb";
    setFormCredentialKind(kind);
    setFormAchievementType(row.achievement_type ?? "Award");
    setFormTriggerType((row.trigger_type as "auto" | "manual") ?? "manual");
    setDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      await saveMutation.mutateAsync({
        hackathonId: contest.id,
        hackathonSlug: contest.slug ?? contest.id,
        templateId: editRow?.id ?? null,
        hackathonRole: formRole,
        isActive: formActive,
        name: formName,
        description: formDescription,
        imageUrl: formImageUrl,
        identifierPrefix: formPrefix,
        credentialKind: formCredentialKind,
        achievementType: formAchievementType,
        triggerType: formTriggerType,
        triggerRule: null,
      });
      toast.success(translate("workspace.awards.saved"));
      setDialogOpen(false);
      await templatesQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.saveFailed"));
    }
  };

  const handleGrant = async () => {
    const ids = grantUserIds
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!resolvedGrantTemplateId || ids.length === 0) {
      toast.error(translate("workspace.awards.grantNeedInputs"));
      return;
    }
    try {
      const res = await grantMutation.mutateAsync({
        templateId: resolvedGrantTemplateId,
        userIds: ids,
        grantedReason: grantReason.trim() || null,
      });
      if (res.errors?.length) {
        toast.error(res.errors.join("\n"));
        if (!res.issuanceIds?.length) return;
      }
      toast.success(translate("workspace.awards.grantOk"));
      setGrantUserIds("");
      await templatesQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.grantFailed"));
    }
  };

  const handleLoadEligible = async () => {
    if (!resolvedEligTemplateId) return;
    setEligSelected(new Set());
    try {
      const result = await eligibleQuery.refetch();
      if (result.error) throw result.error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.loadFailed"));
    }
  };

  const handleEligGrant = async () => {
    const ids = Array.from(eligSelected);
    if (!resolvedEligTemplateId || ids.length === 0) return;
    try {
      const res = await grantMutation.mutateAsync({
        templateId: resolvedEligTemplateId,
        userIds: ids,
      });
      if (res.errors?.length) {
        toast.error(res.errors.join("\n"));
        if (!res.issuanceIds?.length) return;
      }
      toast.success(translate("workspace.awards.eligibilityGrantOk"));
      setEligSelected(new Set());
      await handleLoadEligible();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("workspace.awards.eligibilityGrantFailed"));
    }
  };

  const selectAllUnissued = () => {
    const ids = (eligUsers ?? [])
      .filter((u) => u.issuanceStatus === "none" || u.issuanceStatus === "failed")
      .map((u) => u.userId);
    setEligSelected(new Set(ids));
  };

  const achievementTypes = formCredentialKind === "oca" ? OCA_ACHIEVEMENT_TYPES : OCB_ACHIEVEMENT_TYPES;

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
        <Button type="button" variant={tab === "eligibility" ? "secondary" : "ghost"} onClick={() => setTab("eligibility")}>
          {translate("workspace.awards.tabEligibility")}
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
      ) : tab === "grant" ? (
        <div className="max-w-xl space-y-4">
          <Field>
            <FieldLabel>{translate("workspace.awards.grantTemplateLabel")}</FieldLabel>
            <select
              className={SELECT_CLASS}
              value={resolvedGrantTemplateId}
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
      ) : (
        // Eligibility tab
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <Field>
                <FieldLabel>{translate("workspace.awards.eligibilityTemplateLabel")}</FieldLabel>
                <select
                  className={SELECT_CLASS}
                  value={resolvedEligTemplateId}
                  onChange={(e) => {
                    setEligTemplateId(e.target.value);
                    setEligSelected(new Set());
                  }}
                >
                  {templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.hackathon_role} — {x.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="button" disabled={!resolvedEligTemplateId || eligLoading} onClick={() => void handleLoadEligible()}>
              {eligLoading
                ? translate("workspace.awards.eligibilityLoading")
                : translate("workspace.awards.eligibilityLoad")}
            </Button>
          </div>

          {eligUsers !== null && (
            <>
              {eligUsers.length === 0 ? (
                <p className="text-sm text-foreground-muted">{translate("workspace.awards.eligibilityEmpty")}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllUnissued}>
                      {translate("workspace.awards.eligibilitySelectAll")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEligSelected(new Set())}>
                      {translate("workspace.awards.eligibilityDeselectAll")}
                    </Button>
                    {eligSelected.size > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={eligGranting}
                        onClick={() => void handleEligGrant()}
                      >
                        {eligGranting
                          ? translate("workspace.awards.granting")
                          : translate("workspace.awards.eligibilityGrant").replace("{{count}}", String(eligSelected.size))}
                      </Button>
                    )}
                  </div>

                  <div className="overflow-auto rounded-md border border-border-subtle">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border-subtle bg-surface-raised">
                        <tr>
                          <th className="w-8 px-3 py-2" />
                          <th className="px-3 py-2">{translate("workspace.awards.eligibilityColName")}</th>
                          <th className="px-3 py-2">{translate("workspace.awards.eligibilityColTeam")}</th>
                          <th className="px-3 py-2">{translate("workspace.awards.eligibilityColOcid")}</th>
                          <th className="px-3 py-2">{translate("workspace.awards.eligibilityColStatus")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligUsers.map((u) => {
                          const selectable = u.issuanceStatus === "none" || u.issuanceStatus === "failed";
                          const checked = eligSelected.has(u.userId);
                          return (
                            <tr key={u.userId} className="border-b border-border-subtle last:border-0">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  className="size-4"
                                  disabled={!selectable}
                                  checked={checked}
                                  onChange={(e) => {
                                    setEligSelected((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(u.userId);
                                      else next.delete(u.userId);
                                      return next;
                                    });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">{u.displayName}</td>
                              <td className="px-3 py-2 text-foreground-muted">{u.teamName ?? "—"}</td>
                              <td className="px-3 py-2">
                                {u.hasOcid ? (
                                  <span className="text-success">✓</span>
                                ) : (
                                  <span className="flex items-center gap-1 text-warning text-xs">
                                    <AlertTriangle className="size-3" aria-hidden />
                                    {translate("workspace.awards.eligibilityNoOcid")}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={
                                    u.issuanceStatus === "minted"
                                      ? "text-success"
                                      : u.issuanceStatus === "failed"
                                        ? "text-destructive"
                                        : u.issuanceStatus === "pending"
                                          ? "text-foreground-muted"
                                          : ""
                                  }
                                >
                                  {statusLabel(u.issuanceStatus, translate)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
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
                className={SELECT_CLASS}
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

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{translate("workspace.awards.fieldCredentialKind")}</FieldLabel>
                <select
                  className={SELECT_CLASS}
                  value={formCredentialKind}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const kind = e.target.value as CredentialKind;
                    setFormCredentialKind(kind);
                    setFormAchievementType(kind === "oca" ? "CertificateOfCompletion" : "Badge");
                  }}
                >
                  <option value="ocb">{translate("workspace.awards.kindOcb")}</option>
                  <option value="oca">{translate("workspace.awards.kindOca")}</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>{translate("workspace.awards.fieldAchievementType")}</FieldLabel>
                <select
                  className={SELECT_CLASS}
                  value={formAchievementType}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormAchievementType(e.target.value)}
                >
                  {achievementTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field>
              <FieldLabel>{translate("workspace.awards.fieldTriggerType")}</FieldLabel>
              <select
                className={SELECT_CLASS}
                value={formTriggerType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setFormTriggerType(e.target.value as "auto" | "manual")
                }
              >
                <option value="manual">{translate("workspace.awards.triggerManual")}</option>
                <option value="auto">{translate("workspace.awards.triggerAuto")}</option>
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
                  try {
                    const { url } = await uploadMutation.mutateAsync(file);
                    setFormImageUrl(url);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Upload failed");
                  }
                }}
              />
              {formImageUrl ? (
                <img src={formImageUrl} alt="" className="mt-2 h-16 rounded border border-border-subtle" />
              ) : null}
              <p className="mt-1 text-xs text-foreground-muted">{translate("workspace.awards.imageHint")}</p>
            </Field>
            <Field>
              <FieldLabel>{translate("workspace.awards.fieldPrefix")}</FieldLabel>
              <Input
                value={formPrefix}
                maxLength={40}
                onChange={(e) => setFormPrefix(e.target.value)}
                placeholder={`corelia:${slugLabel}:participant`}
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
