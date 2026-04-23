import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "@/lib/firebase";
import {
  createRecaptchaVerifier,
  enrollWithVerificationCode,
  getEnrolledFactorsDisplay,
  hasEnrolledFactors,
  sendEnrollMfaSms,
} from "@/lib/mfa";
import { useAuth } from "@/stores/authStore";
import { updateCurrentProfile, uploadAvatar } from "@/lib/profile";
import { getMyPaymentTransactions, type PaymentTransaction } from "@/lib/payments";
import type { Profile } from "@/types/database";
import { formatVndPrice } from "@/types/courses";
import { intlLocale } from "@/lib/intl";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import ConnectOCIDCard from "@/components/account/ConnectOCIDCard";
import { useLocale } from "@/hooks/useLocale";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CreditCard,
  FilePenLine,
  GraduationCap,
  IdCard,
  Image as ImageIcon,
  Link2,
  Loader2,
  Settings,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { useTheme } from "next-themes";

function LanguageSettingsCard() {
  const { t: tCommon } = useTranslation("common");
  const { t } = useTranslation("account");
  const { language, setLanguage } = useLocale();

  return (
    <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">
          {t("settings.language.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.language.description")}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void setLanguage("vi")}
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-3 text-left transition-colors duration-150",
            language === "vi"
              ? "border-primary bg-primary/10"
              : "border-border-subtle bg-background hover:bg-muted/30",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {tCommon("language.vi")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.language.viMeta")}
            </div>
          </div>
          {language === "vi" ? (
            <span className="text-xs font-medium text-primary">
              {t("settings.language.active_vi")}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => void setLanguage("en")}
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-3 text-left transition-colors duration-150",
            language === "en"
              ? "border-primary bg-primary/10"
              : "border-border-subtle bg-background hover:bg-muted/30",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {tCommon("language.en")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.language.enMeta")}
            </div>
          </div>
          {language === "en" ? (
            <span className="text-xs font-medium text-primary">
              {t("settings.language.active_en")}
            </span>
          ) : null}
        </button>
      </div>
    </section>
  );
}

function useProfileForm(profile: Profile | null) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");

  return {
    fullName,
    phone,
    avatarUrl,
    setFullName,
    setPhone,
    setAvatarUrl,
  };
}

function ChangePasswordCard({ user }: { user: User }) {
  const { t } = useTranslation("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPasswordProvider = user.providerData?.some(
    (p) => p.providerId === "password",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError(t("password.errors.confirmMismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("password.errors.minLength"));
      return;
    }
    const email = user.email;
    if (!email) {
      setError(t("password.errors.missingEmail"));
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error(t("errors.notLoggedIn"));
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setSuccess(t("password.success.changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("password.errors.changeFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!hasPasswordProvider) return null;

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-medium">{t("password.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("password.subtitle")}
        </p>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="current_password">
            {t("password.fields.current.label")}
          </Label>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("password.fields.current.placeholder")}
            required
            className="rounded"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="new_password">
            {t("password.fields.next.label")}
          </Label>
          <Input
            id="new_password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("password.fields.next.placeholder")}
            required
            minLength={6}
            className="rounded"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="confirm_password">
            {t("password.fields.confirm.label")}
          </Label>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("password.fields.confirm.placeholder")}
            required
            minLength={6}
            className="rounded"
          />
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
            {success}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? t("common.loading") : t("password.actions.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

type MfaStep = "idle" | "reauth" | "phone" | "code";

function MfaEnrollCard({ user }: { user: User }) {
  const { t } = useTranslation("account");
  const [step, setStep] = useState<MfaStep>("idle");
  const [reauthPassword, setReauthPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const recaptchaRef = useRef<ReturnType<typeof createRecaptchaVerifier> | null>(null);

  const hasPasswordProvider = user.providerData?.some(
    (p) => p.providerId === "password",
  );
  const enrolled = hasEnrolledFactors(user);
  const factorsDisplay = getEnrolledFactorsDisplay(user);

  useEffect(() => {
    if (step !== "phone") return;
    const verifier = createRecaptchaVerifier(auth, "mfa-enroll-send-btn", {
      size: "invisible",
    });
    recaptchaRef.current = verifier;
    return () => {
      try {
        verifier.clear();
      } catch {
        // ignore
      }
      recaptchaRef.current = null;
    };
  }, [step]);

  async function handleReauth() {
    setError(null);
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error(t("errors.notLoggedIn"));
      if (hasPasswordProvider && user.email) {
        const credential = EmailAuthProvider.credential(
          user.email,
          reauthPassword,
        );
        await reauthenticateWithCredential(currentUser, credential);
      } else {
        const provider = user.providerData?.some((p) => p.providerId === "google.com")
          ? googleProvider
          : githubProvider;
        await reauthenticateWithPopup(currentUser, provider);
      }
      setStep("phone");
      setReauthPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("mfa.errors.reauthFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode() {
    if (!recaptchaRef.current || !auth.currentUser) return;
    setError(null);
    setLoading(true);
    try {
      let normalized = phone.replace(/\D/g, "");
      if (normalized.startsWith("0")) normalized = normalized.slice(1);
      if (normalized.length < 9) {
        setError(t("mfa.errors.invalidPhone"));
        return;
      }
      const withPlus = normalized.startsWith("84") ? `+${normalized}` : `+84${normalized}`;
      const vid = await sendEnrollMfaSms(
        auth,
        auth.currentUser,
        withPlus,
        recaptchaRef.current,
      );
      setVerificationId(vid);
      setStep("code");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("mfa.errors.sendCodeFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    if (!verificationId || !auth.currentUser) return;
    setError(null);
    setLoading(true);
    try {
      await enrollWithVerificationCode(
        auth.currentUser,
        verificationId,
        code.trim(),
        t("mfa.factorLabel"),
      );
      setSuccess(t("mfa.success.enabled"));
      setStep("idle");
      setVerificationId(null);
      setCode("");
      setPhone("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("mfa.errors.enrollFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep("idle");
    setReauthPassword("");
    setPhone("");
    setVerificationId(null);
    setCode("");
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-medium">{t("mfa.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("mfa.subtitle")}
      </p>

      {enrolled && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium text-muted-foreground">{t("mfa.enrolled.title")}</p>
          <ul className="mt-1 list-disc pl-4">
            {factorsDisplay.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {success && (
        <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "idle" && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setStep("reauth")}
          disabled={loading}
        >
          {t("mfa.actions.addPhone")}
        </Button>
      )}

      {step === "reauth" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("mfa.reauth.hint")}
          </p>
          {hasPasswordProvider ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" htmlFor="mfa-reauth-password">
                {t("mfa.reauth.passwordLabel")}
              </Label>
              <Input
                id="mfa-reauth-password"
                type="password"
                autoComplete="current-password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder={t("mfa.reauth.passwordPlaceholder")}
                className="rounded"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("mfa.reauth.popupHint", {
                provider: user.providerData?.some((p) => p.providerId === "google.com")
                  ? t("mfa.providers.google")
                  : t("mfa.providers.github"),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="default"
              disabled={loading}
              onClick={() => void handleReauth()}
            >
              {loading ? t("common.loading") : t("common.continue")}
            </Button>
            <Button type="button" variant="outline" size="default" onClick={resetFlow}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {step === "phone" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="mfa-enroll-phone">
              {t("mfa.phone.label")}
            </Label>
            <Input
              id="mfa-enroll-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("mfa.phone.placeholder")}
              className="rounded"
            />
          </div>
          <Button
            id="mfa-enroll-send-btn"
            type="button"
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={() => void handleSendCode()}
          >
            {loading ? t("mfa.actions.sending") : t("mfa.actions.sendSms")}
          </Button>
          <Button type="button" variant="outline" className="w-full" size="lg" onClick={resetFlow}>
            {t("common.cancel")}
          </Button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-3">
          <p className="text-sm text-success">{t("mfa.code.hint")}</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="mfa-enroll-code">
              {t("mfa.code.label")}
            </Label>
            <Input
              id="mfa-enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("mfa.code.placeholder")}
              maxLength={6}
              className="rounded font-mono text-lg tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              size="lg"
              disabled={loading || code.length < 6}
              onClick={() => void handleEnroll()}
            >
              {loading ? t("common.loading") : t("common.finish")}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={resetFlow}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSection(props: {
  sessionEmail: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  setFullName: (v: string) => void;
  setPhone: (v: string) => void;
  saving: boolean;
  uploadingAvatar: boolean;
  onAvatarUpload: (file: File) => Promise<void>;
  error: string | null;
  success: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    sessionEmail,
    fullName,
    phone,
    avatarUrl,
    setFullName,
    setPhone,
    saving,
    uploadingAvatar,
    onAvatarUpload,
    error,
    success,
    onSubmit,
  } = props;
  const { t } = useTranslation("account");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    void onAvatarUpload(file);
    e.target.value = "";
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <div className="grid gap-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="grid gap-2">
          <Label className="text-sm font-medium">{t("profile.emailLoginLabel")}</Label>
          <div className="text-sm text-muted-foreground">{sessionEmail}</div>
        </div>

        {/* Ảnh đại diện: preview + upload */}
        <div className="grid gap-3">
          <Label className="text-sm font-medium">{t("profile.avatar.label")}</Label>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-20 shrink-0 rounded-full">
              <AvatarImage src={avatarUrl || undefined} alt={t("profile.avatar.alt")} />
              <AvatarFallback className="text-lg">
                {fullName.trim()
                  ? fullName.trim().slice(0, 2).toUpperCase()
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadingAvatar || saving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || saving}
                className="inline-flex items-center gap-2"
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                    {t("profile.avatar.uploading")}
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-4 shrink-0" aria-hidden />
                    {t("profile.avatar.upload")}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("profile.avatar.hint")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="full_name">
            {t("profile.fullName.label")}
          </Label>
          <Input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("profile.fullName.placeholder")}
            className="rounded"
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.fullName.hint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="phone">
            {t("profile.phone.label")}
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("profile.phone.placeholder")}
            className="rounded"
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.phone.hint")}
          </p>
        </div>
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

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t("profile.actions.saving") : t("profile.actions.save")}
        </Button>
      </div>
    </form>
  );
}

function CvSection() {
  const { t } = useTranslation("account");
  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold">{t("cv.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("cv.subtitle")}
        </p>
      </div>

      <div className="space-y-3 rounded-md bg-muted/60 p-3 text-sm">
        <p className="font-medium">{t("cv.comingSoon.title")}</p>
        <p className="text-muted-foreground">
          {t("cv.comingSoon.body")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("cv.comingSoon.note")}
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <h3 className="font-medium">{t("cv.prep.title")}</h3>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          <li>{t("cv.prep.items.0")}</li>
          <li>{t("cv.prep.items.1")}</li>
          <li>{t("cv.prep.items.2")}</li>
        </ul>
      </div>
    </div>
  );
}

function InstructorProfileSection() {
  const { t } = useTranslation("account");
  const { profile, refreshProfile } = useAuth();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await updateCurrentProfile({
        instructor_headline: headline || null,
        instructor_bio: bio || null,
        instructor_organization: organization || null,
        instructor_website: website || null,
      });
      await refreshProfile();
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
      onSubmit={(e) => void handleSubmit(e)}
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

export function BillingSection() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyPaymentTransactions()
      .then((rows) => {
        if (!cancelled) setTransactions(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : t("billing.errors.fetchFailed"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  const transactionRows = transactions ?? [];

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold">{t("billing.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("billing.subtitle")}
        </p>
      </div>

      {!user ? (
        <div className="rounded-md border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          {t("billing.mustLogin")}
        </div>
      ) : transactions === null && !error ? (
        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden /> {t("billing.loading")}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : transactionRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CreditCard className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t("billing.empty")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("billing.subtitle")}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-subtle">
          <div className="divide-y divide-border-subtle md:hidden">
            {transactionRows.map((tx) => (
              <div key={tx.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {tx.purpose === "course_purchase"
                        ? t("billing.purpose.coursePurchase")
                        : t("billing.purpose.certificateFee")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString(intlLocale())}
                    </div>
                  </div>
                  <span className="rounded-full border border-border-subtle bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                    {tx.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatVndPrice(tx.amount_vnd)}
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  {t("billing.meta.course", { id: tx.course_id })}
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  {t("billing.meta.providerOrder", { provider: tx.provider, order: tx.id })}
                </div>
              </div>
            ))}
          </div>

          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr className="border-b border-border-subtle bg-muted/40">
                <th className="px-4 py-3 font-medium text-foreground">
                  {t("billing.table.time")}
                </th>
                <th className="px-4 py-3 font-medium text-foreground">
                  {t("billing.table.content")}
                </th>
                <th className="px-4 py-3 font-medium text-foreground">
                  {t("billing.table.amount")}
                </th>
                <th className="px-4 py-3 font-medium text-foreground">
                  {t("billing.table.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {transactionRows.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-border-subtle last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString(intlLocale())}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {tx.purpose === "course_purchase"
                        ? t("billing.purpose.coursePurchase")
                        : t("billing.purpose.certificateFee")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("billing.meta.courseProviderOrder", {
                        course: tx.course_id,
                        provider: tx.provider,
                        order: tx.id,
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatVndPrice(tx.amount_vnd)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AccountProfileRoute() {
  const { t } = useTranslation("account");
  const { user, profile, loading, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { fullName, phone, avatarUrl, setFullName, setPhone, setAvatarUrl } =
    useProfileForm(profile);

  async function handleAvatarUpload(file: File) {
    setError(null);
    setSuccess(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      await updateCurrentProfile({ avatar_url: url });
      await refreshProfile();
      setSuccess(t("profile.success.avatarUpdated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("profile.errors.avatarUploadFailed");
      setError(message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await updateCurrentProfile({
        full_name: fullName || null,
        phone: phone || null,
        avatar_url: avatarUrl || null,
      });
      await refreshProfile();
      setSuccess(t("profile.success.updated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("profile.errors.updateFailed");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
          <Skeleton className="h-6 w-56 rounded" />
          <Skeleton className="mt-2 h-4 w-full max-w-[520px] rounded" />
        </div>
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-9 w-44 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-28 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <UserCircle className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{t("profile.mustLogin")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("header.subtitle")}</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-6">
      <ProfileSection
        key={profile.updated_at || profile.id}
        sessionEmail={user.email ?? user.uid}
        fullName={fullName}
        phone={phone}
        avatarUrl={avatarUrl}
        setFullName={setFullName}
        setPhone={setPhone}
        saving={saving}
        uploadingAvatar={uploadingAvatar}
        onAvatarUpload={handleAvatarUpload}
        error={error}
        success={success}
        onSubmit={handleSubmit}
      />
      <ConnectOCIDCard />
      <ChangePasswordCard user={user} />
      <MfaEnrollCard user={user} />
    </div>
  );
}

export function AccountCvRoute() {
  return <CvSection />;
}

export function AccountBillingRoute() {
  return <BillingSection />;
}

function AccountSettingsSection() {
  const { t } = useTranslation("account");
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    void signOut();
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <LanguageSettingsCard />
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-foreground">
              {t("settings.appearance.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.appearance.description")}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border-subtle bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {t("settings.appearance.themeLabel")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                onClick={() => setTheme(themeOption)}
                className={[
                  "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                  (theme ?? "system") === themeOption
                    ? "border-primary/25 bg-primary-container text-on-primary-container shadow-card"
                    : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                ].join(" ")}
              >
                {themeOption === "light"
                  ? t("settings.appearance.light")
                  : themeOption === "dark"
                    ? t("settings.appearance.dark")
                    : t("settings.appearance.system")}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-foreground">
            {t("settings.session.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings.session.description")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-background p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {t("settings.session.signOutTitle")}
            </div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("settings.session.signOutDescription")}
            </div>
          </div>
          <Button type="button" variant="destructive" onClick={handleSignOut}>
            {t("settings.session.signOutButton")}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function AccountSettingsRoute() {
  return <AccountSettingsSection />;
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

export default function Account() {
  const { profile } = useAuth();
  const location = useLocation();
  const { t } = useTranslation("account");
  const navItems = [
    {
      to: "/account/settings",
      title: t("nav.settings.title"),
      description: t("nav.settings.description"),
      icon: <Settings className="size-4 shrink-0" aria-hidden />,
    },
    {
      to: "/account/profile",
      end: false,
      title: t("nav.profile.title"),
      description: t("nav.profile.description"),
      icon: <UserCircle className="size-4 shrink-0" aria-hidden />,
    },
    ...(profile?.role === "instructor"
      ? [
          {
            to: "/account/instructor",
            title: t("nav.instructor.title"),
            description: t("nav.instructor.description"),
            icon: <GraduationCap className="size-4 shrink-0" aria-hidden />,
          },
        ]
      : []),
    {
      to: "/account/cv",
      title: t("nav.cv.title"),
      description: t("nav.cv.description"),
      icon: <IdCard className="size-4 shrink-0" aria-hidden />,
    },
    {
      to: "/account/billing",
      title: t("nav.billing.title"),
      description: t("nav.billing.description"),
      icon: <CreditCard className="size-4 shrink-0" aria-hidden />,
    },
  ];

  const accountRoleLabel =
    profile?.role === "instructor"
      ? t("header.roleLabel.instructor")
      : profile?.role === "admin"
        ? t("header.roleLabel.admin")
        : profile?.role === "support_staff"
        ? t("header.roleLabel.support_staff")
          : t("header.roleLabel.student");
  const activeNavItem =
    navItems.find((item) =>
      location.pathname.startsWith(item.to),
    ) ?? navItems[0];

  // Layout cho khu vực account, nội dung từng tab được render qua nested routes (Outlet)
  return (
    <div className="container-app py-6 sm:py-8">
      <section className="mb-6 rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {accountRoleLabel}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("header.subtitle")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3 sm:col-span-1">
              <p className="text-xs text-muted-foreground">
                {t("header.summary.profileLabel")}
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                {profile?.full_name || t("header.summary.missingDisplayName")}
              </p>
            </div>
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("header.summary.roleLabel")}
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                {accountRoleLabel}
              </p>
            </div>
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("header.summary.statusLabel")}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {t("header.summary.statusReady")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="mb-4 hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
            {t("nav.sectionTitle")}
          </div>
          <div className="-mx-4 overflow-x-auto px-4 lg:hidden">
            <div className="flex min-w-max gap-2 pb-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-primary/25 bg-primary-container text-on-primary-container shadow-card"
                        : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )
                  }
                >
                  <span className="shrink-0 text-primary">{item.icon}</span>
                  <span className="whitespace-nowrap">{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="hidden rounded-md border border-border-subtle bg-card p-2 shadow-card lg:block">
            <div className="grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-3 text-left transition-colors duration-150",
                      isActive
                        ? "bg-primary-container text-on-primary-container shadow-card"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 text-primary">{item.icon}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </div>
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-4">
          <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card lg:hidden">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 text-primary">{activeNavItem.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("nav.currentSectionLabel")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  {activeNavItem.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeNavItem.description}
                </p>
              </div>
            </div>
          </section>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
