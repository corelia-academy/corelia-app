import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingOverlay } from "@/components/base/LoadingOverlay";
import { cn } from "@/lib/utils";

import { saveActivityMilestoneTemplate, type CourseCredentialKind } from "@/lib/credentialTemplates";
import { invokeGrantCredentials, invokeGrantPendingCredential } from "@/lib/credentialsEdge";
import { validatePngSignature } from "@/lib/imageValidation";
import {
  listPendingCredentialsForAdmin,
  revokePendingCredential,
  type PendingCredentialRow,
} from "@/lib/pendingCredentials";
import { getProfile, getProfileByEmail } from "@/lib/profile";
import { uploadActivityMilestoneBadgeImage } from "@/lib/storage";
import type { Profile } from "@/types/database";

import { ManualMintProfilePreviewDialog } from "./components/ManualMintProfilePreviewDialog";

const TEXTAREA_CLASS =
  "min-h-[88px] w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";

type IdentifierType = "uid" | "email";

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminManualMint() {
  const { t } = useTranslation("admin");

  // Step 1 — lookup
  const [identifierType, setIdentifierType] = useState<IdentifierType>("uid");
  const [identifierValue, setIdentifierValue] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  // Set when an email lookup finds no account — ghost-mint mode targets this
  // email directly instead of a resolved userId.
  const [ghostEmail, setGhostEmail] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Step 2 — business form
  const [credentialKind, setCredentialKind] = useState<CourseCredentialKind>("oca");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 3 — pending grants list
  const [pendingList, setPendingList] = useState<PendingCredentialRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoadingPending(true);
    try {
      const list = await listPendingCredentialsForAdmin();
      setPendingList(list);
    } catch {
      setPendingList([]);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    void fetchPending();
  }, []);

  const resetAll = () => {
    setIdentifierValue("");
    setLookupError(null);
    setMatchedProfile(null);
    setGhostEmail(null);
    setCredentialKind("oca");
    setName("");
    setImageUrl("");
    setReason("");
    void fetchPending();
  };

  const handleLookup = async () => {
    const value = identifierValue.trim();
    if (!value) return;
    if (identifierType === "email" && !EMAIL_FORMAT_REGEX.test(value)) {
      setLookupError(t("manualMint.lookup.invalidEmailFormat"));
      return;
    }
    setLooking(true);
    setLookupError(null);
    setMatchedProfile(null);
    setGhostEmail(null);
    try {
      const profile =
        identifierType === "uid" ? await getProfile(value) : await getProfileByEmail(value);
      if (!profile) {
        if (identifierType === "email") {
          // No account yet — ghost-mint mode. The edge function re-checks this
          // right before granting (in case the account gets created in the gap
          // between this lookup and Submit).
          setGhostEmail(value.toLowerCase());
        } else {
          setLookupError(t("manualMint.lookup.notFoundUid"));
        }
        return;
      }
      setMatchedProfile(profile);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : t("manualMint.lookup.error"));
    } finally {
      setLooking(false);
    }
  };

  const handleIdentifierTypeChange = (next: IdentifierType) => {
    setIdentifierType(next);
    setIdentifierValue("");
    setMatchedProfile(null);
    setGhostEmail(null);
    setLookupError(null);
  };

  const onIdentifierKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleLookup();
    }
  };

  const onFileSelect = async (file: File | null) => {
    if (!file) return;
    const isPng = await validatePngSignature(file);
    if (!isPng) {
      toast.error(
        <span>
          {t("manualMint.form.invalidPng")}{" "}
          <a
            href="https://www.remove.bg"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-primary-foreground hover:opacity-85"
          >
            remove.bg
          </a>
        </span>,
      );
      return;
    }
    setUploadingImage(true);
    try {
      const { url } = await uploadActivityMilestoneBadgeImage(file);
      setImageUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("manualMint.form.uploadFailed"));
    } finally {
      setUploadingImage(false);
    }
  };

  const target = matchedProfile ? { kind: "user" as const } : ghostEmail ? { kind: "ghost" as const } : null;
  const canSubmit = !!target && !!name.trim() && !!imageUrl.trim() && !!reason.trim() && !submitting;

  const handleSubmit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const { id: templateId } = await saveActivityMilestoneTemplate({
        templateId: null,
        isActive: true,
        name: name.trim(),
        description: reason.trim(),
        imageUrl,
        identifierPrefix: `corelia:manual-mint-${Date.now()}`.slice(0, 40),
        triggerType: "manual",
        triggerRule: { manual: true },
        credentialKind,
      });

      if (target.kind === "user" && matchedProfile) {
        const result = await invokeGrantCredentials({
          templateId,
          userIds: [matchedProfile.id],
          grantedReason: reason.trim(),
        });
        if (result.errors && result.errors.length > 0) {
          toast.error(result.errors.join("; "));
        } else {
          toast.success(t("manualMint.form.success"));
          resetAll();
        }
        return;
      }

      if (target.kind === "ghost" && ghostEmail) {
        const result = await invokeGrantPendingCredential({
          templateId,
          email: ghostEmail,
          grantedReason: reason.trim(),
        });
        if (result.errors && result.errors.length > 0) {
          // Race condition: email got an account between lookup and submit —
          // backend granted directly instead of staging a ghost row.
          toast.error(result.errors.join("; "));
        } else if (result.mode === "direct") {
          toast.success(t("manualMint.form.success"));
        } else {
          toast.success(t("manualMint.form.successGhost"));
        }
        resetAll();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("manualMint.form.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (item: PendingCredentialRow) => {
    const confirmed = window.confirm(
      t("manualMint.pendingList.revokeConfirm", {
        email: item.email,
        defaultValue: `Thu hồi cấp chờ cho "${item.email}"? Hành động này không thể hoàn tác.`,
      }),
    );
    if (!confirmed) return;

    const id = item.id;
    setRevokingId(id);
    try {
      await revokePendingCredential(id);
      toast.success(t("manualMint.pendingList.revokeSuccess"));
      await fetchPending();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("manualMint.pendingList.revokeFailed"));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <LoadingOverlay show={looking} label={t("manualMint.lookup.loading")} />

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t("manualMint.heading")}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{t("manualMint.subheading")}</p>
      </div>

      {/* Step 1 — identifier lookup */}
      <div className="space-y-3 rounded-md border border-border-subtle p-4">
        <FieldLabel>{t("manualMint.lookup.heading")}</FieldLabel>
        <div className="flex gap-2">
          <div className="flex shrink-0 overflow-hidden rounded-md border border-border-subtle">
            <button
              type="button"
              onClick={() => handleIdentifierTypeChange("uid")}
              className={cn(
                "px-3 py-2 text-sm font-medium transition-colors",
                identifierType === "uid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-base text-foreground-muted hover:bg-surface-raised",
              )}
            >
              UID
            </button>
            <button
              type="button"
              onClick={() => handleIdentifierTypeChange("email")}
              className={cn(
                "px-3 py-2 text-sm font-medium transition-colors",
                identifierType === "email"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-base text-foreground-muted hover:bg-surface-raised",
              )}
            >
              Email
            </button>
          </div>
          <Input
            value={identifierValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setIdentifierValue(e.target.value);
              if (matchedProfile) setMatchedProfile(null);
              if (ghostEmail) setGhostEmail(null);
              if (lookupError) setLookupError(null);
            }}
            onKeyDown={onIdentifierKeyDown}
            placeholder={
              identifierType === "uid"
                ? t("manualMint.lookup.uidPlaceholder")
                : t("manualMint.lookup.emailPlaceholder")
            }
            className="flex-1"
          />
          <Button type="button" onClick={() => void handleLookup()} disabled={looking || !identifierValue.trim()}>
            {t("manualMint.lookup.submit")}
          </Button>
        </div>
        {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}

        {matchedProfile ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-raised p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {matchedProfile.full_name || t("manualMint.preview.noName")}
              </p>
              <p className="truncate text-xs text-foreground-muted">{matchedProfile.email}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              {t("manualMint.lookup.previewProfile")}
            </Button>
          </div>
        ) : null}

        {ghostEmail ? (
          <div className="rounded-md border border-warning/25 bg-warning/8 p-3 text-sm text-foreground-muted">
            {t("manualMint.lookup.ghostNotice", { email: ghostEmail })}
          </div>
        ) : null}
      </div>

      {/* Step 2 — business form */}
      <div
        className={cn(
          "mt-4 space-y-3 rounded-md border border-border-subtle p-4",
          !target && "pointer-events-none opacity-50",
        )}
      >
        <Field>
          <FieldLabel>{t("manualMint.form.kind")}</FieldLabel>
          <div className="flex overflow-hidden rounded-md border border-border-subtle">
            <button
              type="button"
              onClick={() => setCredentialKind("oca")}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                credentialKind === "oca"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-base text-foreground-muted hover:bg-surface-raised",
              )}
            >
              OCA
            </button>
            <button
              type="button"
              onClick={() => setCredentialKind("ocb")}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                credentialKind === "ocb"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-base text-foreground-muted hover:bg-surface-raised",
              )}
            >
              OCB
            </button>
          </div>
        </Field>

        <Field>
          <FieldLabel>{t("manualMint.form.name")}</FieldLabel>
          <Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
        </Field>

        <Field>
          <FieldLabel>{t("manualMint.form.image")}</FieldLabel>
          <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border-subtle bg-surface-base p-6 text-center transition-colors hover:bg-surface-raised">
            <input
              type="file"
              accept="image/png"
              disabled={uploadingImage}
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e: ChangeEvent<HTMLInputElement>) => void onFileSelect(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col items-center gap-2 text-sm text-foreground-muted">
              {uploadingImage ? (
                <>
                  <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                  <span className="font-medium text-primary">{t("manualMint.form.uploading")}</span>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-surface-raised p-3">
                    <Upload className="size-5" aria-hidden />
                  </div>
                  <span className="font-medium text-primary">{t("manualMint.form.uploadCta")}</span>
                </>
              )}
            </div>
          </div>
          {imageUrl ? (
            <div className="mt-3 overflow-hidden rounded-md border border-border-subtle bg-surface-raised p-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground-muted">
                <ImageIcon className="size-4" />
                {t("manualMint.form.imagePreview")}
              </div>
              <img src={imageUrl} alt="" className="h-32 w-full object-contain" />
            </div>
          ) : null}
        </Field>

        <Field>
          <FieldLabel>{t("manualMint.form.reason")}</FieldLabel>
          <textarea
            rows={3}
            value={reason}
            className={TEXTAREA_CLASS}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
          />
        </Field>

        <Button type="button" className="w-full" disabled={!canSubmit} onClick={() => void handleSubmit()}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              {t("manualMint.form.submitting")}
            </>
          ) : (
            t("manualMint.form.submit")
          )}
        </Button>
      </div>

      {/* Step 3 — Pending credential issuances (Ghost Minting Dashboard) */}
      <div className="mt-8 space-y-3 rounded-md border border-border-subtle p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("manualMint.pendingList.heading")}</h2>
          <p className="mt-1 text-xs text-foreground-muted">{t("manualMint.pendingList.subheading")}</p>
        </div>

        {loadingPending ? (
          <div className="flex items-center justify-center py-6 text-sm text-foreground-muted">
            <Loader2 className="mr-2 size-4 animate-spin text-primary" />
            {t("manualMint.lookup.loading")}
          </div>
        ) : pendingList.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-muted">{t("manualMint.pendingList.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-subtle text-foreground-muted">
                <tr>
                  <th className="pb-2 font-medium">{t("manualMint.pendingList.emailCol")}</th>
                  <th className="pb-2 font-medium">{t("manualMint.pendingList.badgeCol")}</th>
                  <th className="pb-2 font-medium">{t("manualMint.pendingList.reasonCol")}</th>
                  <th className="pb-2 font-medium">{t("manualMint.pendingList.dateCol")}</th>
                  <th className="pb-2 font-medium">{t("manualMint.pendingList.statusCol")}</th>
                  <th className="pb-2 text-right font-medium">{t("manualMint.pendingList.actionsCol")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {pendingList.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="py-2.5 font-medium text-foreground">{item.email}</td>
                    <td className="py-2.5 text-foreground-muted">{item.template_name || item.template_id}</td>
                    <td className="py-2.5 text-foreground-muted max-w-[180px] truncate">
                      {item.granted_reason || "—"}
                    </td>
                    <td className="py-2.5 text-foreground-muted">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        {t("manualMint.pendingList.statusAwaiting")}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        disabled={revokingId === item.id}
                        onClick={() => void handleRevoke(item)}
                      >
                        {revokingId === item.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          t("manualMint.pendingList.revokeBtn")
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ManualMintProfilePreviewDialog
        userId={matchedProfile?.id ?? null}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
