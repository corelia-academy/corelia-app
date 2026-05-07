import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import {
  Building2,
  FilePenLine,
  GraduationCap,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/stores/authStore";
import { updateProfileForUser } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function InstructorProfileSection() {
  const { t } = useTranslation("account");
  const { user, profile, refreshProfile } = useAuth();
  const [headline, setHeadline] = useState(profile?.instructor_headline ?? "");
  const [bio, setBio] = useState(profile?.instructor_bio ?? "");
  const [organization, setOrganization] = useState(
    profile?.instructor_organization ?? "",
  );
  const [website, setWebsite] = useState(profile?.instructor_website ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!profile || profile.role !== "instructor") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <GraduationCap className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("instructorProfile.onlyInstructors")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("nav.instructor.description")}
          </p>
        </div>
      </div>
    );
  }

  async function onSubmitInstructorProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!user) return;
      await updateProfileForUser(user, {
        instructor_headline: headline || null,
        instructor_bio: bio || null,
        instructor_organization: organization || null,
        instructor_website: website || null,
      });
      await refreshProfile(user);
      setSuccess(t("instructorProfile.success.updated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("instructorProfile.errors.updateFailed");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const originLabel =
    profile.instructor_origin === "corelia"
      ? t("instructorProfile.origin.corelia")
      : profile.instructor_origin === "external"
        ? t("instructorProfile.origin.external")
        : t("instructorProfile.origin.unknown");
  const completedFields = [headline, bio, organization, website].filter((value) =>
    value.trim(),
  ).length;
  const completionPercent = Math.round((completedFields / 4) * 100);

  return (
    <form
      onSubmit={(e) => void onSubmitInstructorProfile(e)}
      className="space-y-5 rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t("instructorProfile.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("instructorProfile.subtitle")}
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
            <ShieldCheck className="mr-2 size-4 shrink-0 text-primary" aria-hidden />
            {t("instructorProfile.completion", { percent: completionPercent })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("instructorProfile.cards.originLabel")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {originLabel}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("instructorProfile.cards.organizationLabel")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {organization.trim() || t("instructorProfile.common.notUpdated")}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("instructorProfile.cards.headlineLabel")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {headline.trim() || t("instructorProfile.common.notUpdated")}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("instructorProfile.cards.websiteLabel")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {website.trim() || t("instructorProfile.common.notUpdated")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
            {t("instructorProfile.tips.organization.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("instructorProfile.tips.organization.body")}
          </p>
        </div>
        <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <FilePenLine className="size-4 shrink-0 text-primary" aria-hidden />
            {t("instructorProfile.tips.intro.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("instructorProfile.tips.intro.body")}
          </p>
        </div>
        <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Link2 className="size-4 shrink-0 text-primary" aria-hidden />
            {t("instructorProfile.tips.externalProfile.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("instructorProfile.tips.externalProfile.body")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="instructor_origin">
            {t("instructorProfile.fields.origin.label")}
          </Label>
          <div className="rounded border border-input bg-muted/40 px-3 py-2 text-sm">
            {originLabel}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("instructorProfile.fields.origin.hint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="instructor_org">
            {t("instructorProfile.fields.organization.label")}
          </Label>
          <Input
            id="instructor_org"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder={t("instructorProfile.fields.organization.placeholder")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium" htmlFor="instructor_headline">
          {t("instructorProfile.fields.headline.label")}
        </Label>
        <Input
          id="instructor_headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder={t("instructorProfile.fields.headline.placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium" htmlFor="instructor_bio">
          {t("instructorProfile.fields.bio.label")}
        </Label>
        <textarea
          id="instructor_bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          className="min-h-[120px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={t("instructorProfile.fields.bio.placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium" htmlFor="instructor_website">
          {t("instructorProfile.fields.website.label")}
        </Label>
        <Input
          id="instructor_website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t("instructorProfile.fields.website.placeholder")}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">
          {success}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? t("instructorProfile.actions.saving") : t("instructorProfile.actions.save")}
        </Button>
      </div>
    </form>
  );
}

export function AccountInstructorProfileRoute() {
  const { profile } = useAuth();
  if (profile?.role !== "instructor") {
    return <Navigate to="/account" replace />;
  }
  return <InstructorProfileSection />;
}

export function InstructorWorkspaceProfileRoute() {
  return (
    <div className="container-app py-6 sm:py-8">
      <InstructorProfileSection />
    </div>
  );
}

