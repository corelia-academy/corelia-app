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
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConnectOCIDCard from "@/components/account/ConnectOCIDCard";
import {
  Buildings,
  CreditCard,
  GraduationCap,
  Gear,
  IdentificationCard,
  ImageSquare,
  LinkSimple,
  NotePencil,
  ShieldCheck,
  SpinnerGap,
  UserCircle,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";

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
      setError("Mật khẩu mới và xác nhận không khớp.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    const email = user.email;
    if (!email) {
      setError("Không tìm thấy email. Chỉ tài khoản đăng nhập bằng email mới đổi được mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Chưa đăng nhập");
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setSuccess("Đã đổi mật khẩu thành công.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không thể đổi mật khẩu.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!hasPasswordProvider) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-medium">Đổi mật khẩu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chỉ áp dụng cho tài khoản đăng nhập bằng Email & Mật khẩu.
        </p>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="current_password">
            Mật khẩu hiện tại
          </label>
          <input
            id="current_password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Nhập mật khẩu hiện tại"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="new_password">
            Mật khẩu mới
          </label>
          <input
            id="new_password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Tối thiểu 6 ký tự"
            required
            minLength={6}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="confirm_password">
            Xác nhận mật khẩu mới
          </label>
          <input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Nhập lại mật khẩu mới"
            required
            minLength={6}
          />
        </div>
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
            {success}
          </div>
        ) : null}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Đang xử lý…" : "Đổi mật khẩu"}
          </button>
        </div>
      </form>
    </div>
  );
}

type MfaStep = "idle" | "reauth" | "phone" | "code";

function MfaEnrollCard({ user }: { user: User }) {
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
      if (!currentUser) throw new Error("Chưa đăng nhập");
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
        err instanceof Error ? err.message : "Xác thực lại thất bại. Vui lòng thử lại.",
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
        setError("Số điện thoại không hợp lệ (ví dụ: 0901234567 hoặc +84901234567).");
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
        err instanceof Error ? err.message : "Không thể gửi mã. Vui lòng thử lại.",
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
        "Số điện thoại xác thực",
      );
      setSuccess("Đã bật xác thực hai yếu tố (SMS).");
      setStep("idle");
      setVerificationId(null);
      setCode("");
      setPhone("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đăng ký thất bại. Vui lòng thử lại.",
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
    <div className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-muted-foreground" weight="duotone" />
        <h2 className="text-base font-medium">Bảo mật hai lớp (MFA)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Thêm số điện thoại để nhận mã SMS khi đăng nhập, giúp tài khoản an toàn hơn.
      </p>

      {enrolled && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium text-muted-foreground">Số đã đăng ký xác thực:</p>
          <ul className="mt-1 list-disc pl-4">
            {factorsDisplay.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "idle" && (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-lg"
          onClick={() => setStep("reauth")}
          disabled={loading}
        >
          Thêm số điện thoại xác thực
        </Button>
      )}

      {step === "reauth" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vì lý do bảo mật, vui lòng xác thực lại trước khi thêm số điện thoại.
          </p>
          {hasPasswordProvider ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="mfa-reauth-password">
                Mật khẩu hiện tại
              </label>
              <Input
                id="mfa-reauth-password"
                type="password"
                autoComplete="current-password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="rounded-lg"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bấm nút bên dưới để đăng nhập lại bằng {user.providerData?.some((p) => p.providerId === "google.com") ? "Google" : "GitHub"}.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="default"
              disabled={loading}
              onClick={() => void handleReauth()}
            >
              {loading ? "Đang xử lý…" : "Tiếp tục"}
            </Button>
            <Button type="button" variant="outline" size="default" onClick={resetFlow}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {step === "phone" && (
        <div className="space-y-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="mfa-enroll-phone">
              Số điện thoại (E.164, ví dụ +84901234567)
            </label>
            <Input
              id="mfa-enroll-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+84 901 234 567"
              className="rounded-lg"
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
            {loading ? "Đang gửi…" : "Gửi mã SMS"}
          </Button>
          <Button type="button" variant="outline" className="w-full" size="lg" onClick={resetFlow}>
            Hủy
          </Button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-3">
          <p className="text-sm text-success">Mã đã gửi. Nhập mã 6 số vào ô bên dưới.</p>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="mfa-enroll-code">
              Mã xác thực
            </label>
            <Input
              id="mfa-enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="rounded-lg font-mono text-lg tracking-widest"
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
              {loading ? "Đang xử lý…" : "Hoàn tất"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={resetFlow}>
              Hủy
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    void onAvatarUpload(file);
    e.target.value = "";
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <div className="grid gap-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Email đăng nhập</label>
          <div className="text-sm text-muted-foreground">{sessionEmail}</div>
        </div>

        {/* Ảnh đại diện: preview + upload */}
        <div className="grid gap-3">
          <label className="text-sm font-medium">Ảnh đại diện</label>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-20 shrink-0 rounded-full">
              <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
              <AvatarFallback className="text-xl">
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || saving}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <>
                    <SpinnerGap className="size-4 animate-spin" weight="bold" />
                    Đang tải lên…
                  </>
                ) : (
                  <>
                    <ImageSquare className="size-4" weight="duotone" />
                    Tải ảnh lên
                  </>
                )}
              </button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG hoặc WebP. Ảnh sẽ được lưu và cập nhật ngay.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="full_name">
            Họ và tên đầy đủ
          </label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Nguyễn Văn A"
          />
          <p className="text-xs text-muted-foreground">
            Dùng để hiển thị trên chứng chỉ, bảng điểm và hoá đơn.
          </p>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="phone">
            Số điện thoại liên hệ
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ví dụ: 09xxxxxxxx"
          />
          <p className="text-xs text-muted-foreground">
            Dùng cho chăm sóc viên/học vụ liên hệ khi cần hỗ trợ.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

function CvSection() {
  return (
    <div className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold">Hồ sơ học tập & CV</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tổng hợp thông tin phục vụ tư vấn nghề nghiệp, giới thiệu việc làm và
          hỗ trợ học bổng.
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-medium">Quản lý CV (sắp ra mắt)</p>
        <p className="text-muted-foreground">
          Bạn sẽ có thể tải CV (PDF) và cập nhật thông tin nghề nghiệp của mình
          trực tiếp tại đây. Chức năng này giúp giảng viên và chăm sóc viên có
          thêm ngữ cảnh để hỗ trợ lộ trình học tập.
        </p>
        <p className="text-xs text-muted-foreground">
          Tạm thời, bạn có thể thêm link CV (Google Drive, Notion, v.v.) vào
          phần mô tả mở rộng hồ sơ khi tính năng hoàn thiện.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <h3 className="font-medium">Gợi ý thông tin nên chuẩn bị</h3>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          <li>Kinh nghiệm làm việc / dự án cá nhân nổi bật.</li>
          <li>Các khoá học đã hoàn thành, chứng chỉ liên quan.</li>
          <li>Kỹ năng chuyên môn (technical) và kỹ năng mềm.</li>
        </ul>
      </div>
    </div>
  );
}

function InstructorProfileSection() {
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
      <div className="rounded-lg border border-border-subtle bg-card p-4 text-sm text-muted-foreground">
        Chỉ giảng viên mới có thể chỉnh sửa hồ sơ giảng dạy.
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
      setSuccess("Đã cập nhật hồ sơ giảng viên.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể cập nhật hồ sơ giảng viên.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const originLabel =
    profile.instructor_origin === "corelia"
      ? "Giảng viên Corelia"
      : profile.instructor_origin === "external"
        ? "Giảng viên đối tác (bên ngoài)"
        : "Chưa phân loại";
  const completedFields = [headline, bio, organization, website].filter((value) =>
    value.trim(),
  ).length;
  const completionPercent = Math.round((completedFields / 4) * 100);

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-5 rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-foreground">Hồ sơ giảng viên</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Đây là hồ sơ "show off" hiển thị cho học viên trên trang giảng viên và
              trang khoá học.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
            <ShieldCheck className="mr-1.5 size-4 text-primary" weight="duotone" />
            {completionPercent}% hoàn thiện
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Loại giảng viên
            </p>
            <p className="mt-2 text-[15px] font-medium text-foreground">
              {originLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Đơn vị công tác
            </p>
            <p className="mt-2 text-[15px] font-medium text-foreground">
              {organization.trim() || "Chưa cập nhật"}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Headline
            </p>
            <p className="mt-2 text-[15px] font-medium text-foreground">
              {headline.trim() || "Chưa cập nhật"}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Website / Portfolio
            </p>
            <p className="mt-2 text-[15px] font-medium text-foreground">
              {website.trim() || "Chưa cập nhật"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Buildings className="size-4 text-primary" weight="duotone" />
            Hiển thị tổ chức
          </div>
          <p className="text-sm text-muted-foreground">
            Đơn vị công tác giúp học viên hiểu bối cảnh chuyên môn của bạn.
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <NotePencil className="size-4 text-primary" weight="duotone" />
            Giới thiệu ngắn
          </div>
          <p className="text-sm text-muted-foreground">
            Headline và bio nên nêu rõ thế mạnh, kinh nghiệm và lĩnh vực giảng dạy.
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <LinkSimple className="size-4 text-primary" weight="duotone" />
            Dẫn về hồ sơ ngoài
          </div>
          <p className="text-sm text-muted-foreground">
            LinkedIn hoặc portfolio giúp tăng độ tin cậy khi học viên cân nhắc đăng ký.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="instructor_origin">
            Loại giảng viên
          </label>
          <div className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
            {originLabel}
          </div>
          <p className="text-xs text-muted-foreground">
            Loại giảng viên chỉ do học vụ/admin cập nhật.
          </p>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="instructor_org">
            Đơn vị công tác / tổ chức
          </label>
          <Input
            id="instructor_org"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Ví dụ: Corelia, Công ty ABC, Trường ĐH XYZ..."
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="instructor_headline">
          Tiêu đề ngắn (headline)
        </label>
        <Input
          id="instructor_headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Ví dụ: Senior Frontend Engineer, Data Analytics Mentor..."
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="instructor_bio">
          Giới thiệu giảng viên
        </label>
        <textarea
          id="instructor_bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Chia sẻ kinh nghiệm giảng dạy, dự án thực tế, doanh nghiệp đã làm việc, các lĩnh vực chuyên môn chính..."
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="instructor_website">
          Website / LinkedIn / portfolio
        </label>
        <Input
          id="instructor_website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..., linkedin.com/in/..., portfolio cá nhân"
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu hồ sơ giảng viên"}
        </button>
      </div>
    </form>
  );
}

export function BillingSection() {
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
          setError(e instanceof Error ? e.message : "Không lấy được lịch sử thanh toán.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const transactionRows = transactions ?? [];

  return (
    <div className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold">Lịch sử thanh toán</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Xem lại các lần đóng học phí, hoá đơn và thông tin liên quan để tiện
          đối soát khi cần.
        </p>
      </div>

      {!user ? (
        <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          Bạn cần đăng nhập để xem lịch sử thanh toán.
        </div>
      ) : transactions === null && !error ? (
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          <SpinnerGap className="size-4 animate-spin" /> Đang tải lịch sử...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : transactionRows.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          Chưa có giao dịch nào.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <div className="divide-y divide-border-subtle md:hidden">
            {transactionRows.map((t) => (
              <div key={t.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {t.purpose === "course_purchase" ? "Mua khoá học" : "Phí chứng nhận"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <span className="rounded-full border border-border-subtle bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                    {t.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatVndPrice(t.amount_vnd)}
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  Course: {t.course_id}
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  Provider: {t.provider} · Order: {t.id}
                </div>
              </div>
            ))}
          </div>

          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr className="border-b border-border-subtle bg-muted/40">
                <th className="px-4 py-3 font-medium text-foreground">Thời gian</th>
                <th className="px-4 py-3 font-medium text-foreground">Nội dung</th>
                <th className="px-4 py-3 font-medium text-foreground">Số tiền</th>
                <th className="px-4 py-3 font-medium text-foreground">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {transactionRows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border-subtle last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {t.purpose === "course_purchase"
                        ? "Mua khoá học"
                        : "Phí chứng nhận"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Course: {t.course_id} · Provider: {t.provider} · Order: {t.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatVndPrice(t.amount_vnd)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {t.status}
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
      setSuccess("Đã cập nhật ảnh đại diện.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tải ảnh lên.";
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
      setSuccess("Thông tin tài khoản đã được cập nhật.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể cập nhật thông tin.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-muted-foreground">Đang tải thông tin...</span>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Bạn cần đăng nhập để xem trang này.
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
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    void signOut();
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-foreground">Giao diện</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chọn chế độ hiển thị phù hợp với môi trường của bạn.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border-subtle bg-background p-3">
          <div className="text-[12px] font-medium text-muted-foreground">
            Theme
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={[
                  "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                  (theme ?? "system") === t
                    ? "border-primary/25 bg-primary-container text-on-primary-container shadow-card"
                    : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                ].join(" ")}
              >
                {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-foreground">Phiên đăng nhập</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý trạng thái đăng nhập trên thiết bị này.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-background p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Đăng xuất</div>
            <div className="mt-1 text-[13px] leading-5 text-muted-foreground">
              Kết thúc phiên hiện tại trên thiết bị này.
            </div>
          </div>
          <Button type="button" variant="destructive" onClick={handleSignOut}>
            Đăng xuất
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
  const navItems = [
    {
      to: "/account/settings",
      title: "Cài đặt",
      description: "Theme, đăng xuất",
      icon: <Gear className="size-4" weight="duotone" />,
    },
    {
      to: "/account",
      end: true,
      title: "Thông tin cá nhân",
      description: "Họ tên, liên hệ, avatar",
      icon: <UserCircle className="size-4" weight="duotone" />,
    },
    ...(profile?.role === "instructor"
      ? [
          {
            to: "/account/instructor",
            title: "Hồ sơ giảng viên",
            description: "Thông tin hiển thị cho học viên",
            icon: <GraduationCap className="size-4" weight="duotone" />,
          },
        ]
      : []),
    {
      to: "/account/cv",
      title: "Hồ sơ học tập & CV",
      description: "Thông tin phục vụ tư vấn & việc làm",
      icon: <IdentificationCard className="size-4" weight="duotone" />,
    },
    {
      to: "/account/billing",
      title: "Thanh toán & lịch sử",
      description: "Hoá đơn, lịch sử thanh toán",
      icon: <CreditCard className="size-4" weight="duotone" />,
    },
  ] as const;

  const accountRoleLabel =
    profile?.role === "instructor"
      ? "Tài khoản giảng viên"
      : profile?.role === "admin"
        ? "Tài khoản quản trị"
        : profile?.role === "support_staff"
        ? "Tài khoản học vụ"
          : "Tài khoản học viên";
  const activeNavItem =
    navItems.find((item) =>
      item.to === "/account"
        ? location.pathname === "/account"
        : location.pathname.startsWith(item.to),
    ) ?? navItems[0];

  // Layout cho khu vực account, nội dung từng tab được render qua nested routes (Outlet)
  return (
    <div className="container-app py-6 sm:py-8">
      <section className="mb-6 rounded-lg border border-border-subtle bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
              {accountRoleLabel}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
              Quản lý thông tin cá nhân, bảo mật, hồ sơ nghề nghiệp và toàn bộ
              lịch sử thanh toán của bạn trong một nơi.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3 sm:col-span-1">
              <p className="text-[12px] text-muted-foreground">Hồ sơ</p>
              <p className="mt-1 line-clamp-1 text-[15px] font-medium text-foreground">
                {profile?.full_name || "Chưa cập nhật tên hiển thị"}
              </p>
            </div>
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <p className="text-[12px] text-muted-foreground">Vai trò</p>
              <p className="mt-1 line-clamp-1 text-[15px] font-medium text-foreground">
                {profile?.role || "student"}
              </p>
            </div>
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <p className="text-[12px] text-muted-foreground">Trạng thái</p>
              <p className="mt-1 text-[15px] font-medium text-foreground">
                Sẵn sàng học và theo dõi tiến độ
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="mb-4 hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
            Thiết lập tài khoản
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

          <div className="hidden rounded-2xl border border-border-subtle bg-card p-2 shadow-card lg:block">
            <div className="grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      "rounded-xl px-3 py-3 text-left transition",
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
          <section className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card lg:hidden">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 text-primary">{activeNavItem.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mục đang xem
                </p>
                <h2 className="mt-1 text-base font-medium text-foreground">
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
