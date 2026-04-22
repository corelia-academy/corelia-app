import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Certificate,
  FileText,
  Gear,
  List,
  Users,
  Warning,
} from "@phosphor-icons/react";
import { createCourse, updateCourse } from "@/lib/courses";
import { uploadCourseThumbnail } from "@/lib/storage";
import {
  COURSE_ACCESS_MODEL_LABELS,
  COURSE_LEVEL_LABELS,
  COURSE_OWNER_TYPE_LABELS,
  type CourseOwnerType,
  type CourseAccessModel,
  type CourseLevel,
} from "@/types/courses";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const normalizeVndDigits = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const formatVndInput = (value: string) =>
  value ? Number(value).toLocaleString("vi-VN") : "";

const InstructorCourseNew = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    short_description: "",
    thumbnail_url:
      "https://placehold.co/640x360/1e3a5f/fff?text=Kho%C3%A1+h%E1%BB%8Dc",
    level: "all" as CourseLevel,
    published: false,
    access_model: "free" as CourseAccessModel,
    price_vnd: "",
    certificate_fee_vnd: "",
    owner_type: "corelia" as CourseOwnerType,
    platform_revenue_share_percent: "100",
  });
  const canManageBusinessSettings =
    profile?.role === "admin" || profile?.role === "support_staff";
  const showBusinessSettingsSection =
    canManageBusinessSettings || profile?.instructor_origin !== "external";

  useEffect(() => {
    if (!profile || canManageBusinessSettings) return;
    if (profile.instructor_origin === "external") {
      setForm((prev) => ({ ...prev, owner_type: "external_partner" }));
    } else if (profile.instructor_origin === "corelia") {
      setForm((prev) => ({ ...prev, owner_type: "corelia" }));
    }
  }, [profile, canManageBusinessSettings]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailFile(file);
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSlugFromTitle = () => {
    const s = form.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((prev) => ({ ...prev, slug: s }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !profile?.full_name) {
      setError("Vui lòng cập nhật họ tên trong Tài khoản.");
      return;
    }
    if (!form.title.trim()) {
      setError("Nhập tên khoá học.");
      return;
    }
    if (form.access_model === "paid_upfront" && Number(form.price_vnd) <= 0) {
      setError("Nhập giá khoá học hợp lệ cho mô hình trả phí trước.");
      return;
    }
    if (
      form.access_model === "free_with_paid_certificate" &&
      Number(form.certificate_fee_vnd) <= 0
    ) {
      setError("Nhập phí chứng nhận hợp lệ cho mô hình học miễn phí.");
      return;
    }
    if (
      form.owner_type === "external_partner" &&
      (Number(form.platform_revenue_share_percent) < 0 ||
        Number(form.platform_revenue_share_percent) > 100)
    ) {
      setError("Tỷ lệ chia sẻ cho nền tảng phải từ 0 đến 100%.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const course = await createCourse({
        title: form.title.trim(),
        slug:
          form.slug.trim() ||
          form.title.trim().toLowerCase().replace(/\s+/g, "-"),
        description: form.description.trim(),
        short_description: form.short_description.trim() || "",
        thumbnail_url: form.thumbnail_url.trim(),
        instructor_id: profile.id,
        instructor_name: profile.full_name,
        level: form.level,
        total_duration_seconds: 0,
        published: form.published,
        access_model: form.access_model,
        price_vnd:
          form.access_model === "paid_upfront"
            ? Number(form.price_vnd || 0)
            : null,
        certificate_fee_vnd:
          form.access_model === "free_with_paid_certificate"
            ? Number(form.certificate_fee_vnd || 0)
            : null,
        owner_type: form.owner_type,
        platform_revenue_share_percent:
          form.owner_type === "corelia"
            ? 100
            : Number(form.platform_revenue_share_percent || 0),
      });

      if (thumbnailFile) {
        setUploadingThumb(true);
        try {
          const result = await uploadCourseThumbnail(course.id, thumbnailFile);
          await updateCourse(course.id, {
            thumbnail_url: result.url,
            thumbnail_path: result.path,
          });
        } finally {
          setUploadingThumb(false);
        }
      }

      toast.success("Tạo khoá học thành công. Bạn có thể tiếp tục chỉnh sửa.");
      navigate(`/instructor/courses/${course.id}/edit`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo khoá học");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="mb-6 rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="max-w-3xl text-[14px] text-muted-foreground sm:text-[15px]">
              Thiết lập nhanh cấu hình khởi tạo trước khi chuyển sang màn chỉnh sửa chi tiết.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
              Bước 1: Khởi tạo
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {profile?.instructor_origin === "external"
                ? "Đối tác bên ngoài"
                : "Giảng viên Corelia"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Trạng thái
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">Bản nháp</p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Loại truy cập
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {COURSE_ACCESS_MODEL_LABELS[form.access_model]}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Sở hữu doanh thu
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {COURSE_OWNER_TYPE_LABELS[form.owner_type]}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Cấp độ
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {COURSE_LEVEL_LABELS[form.level]}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <nav className="h-fit rounded-2xl border border-border-subtle bg-card p-3 shadow-card xl:sticky xl:top-24">
          <div className="mb-3 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Lộ trình thiết lập
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Sau bước khởi tạo này, bạn sẽ tiếp tục hoàn thiện nội dung và cấu hình nâng cao.
              
            </p>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl bg-sidebar-accent px-3 py-2.5 text-left text-[13px] font-medium text-sidebar-accent-foreground"
              >
                <Gear className="size-4 shrink-0" weight="duotone" />
                Thông tin chung
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground opacity-60"
              >
                <List className="size-4 shrink-0" weight="duotone" />
                Nội dung & bài học
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground opacity-60"
              >
                <FileText className="size-4 shrink-0" weight="duotone" />
                Bài tập cuối khoá
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground opacity-60"
              >
                <Certificate className="size-4 shrink-0" weight="duotone" />
                Chứng nhận
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground opacity-60"
              >
                <Users className="size-4 shrink-0" weight="duotone" />
                Quản lý học viên
              </button>
            </li>
            <li className="border-t border-border-subtle mt-2 pt-2">
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground opacity-60"
              >
                <Warning className="size-4 shrink-0" weight="duotone" />
                Xoá khoá học
              </button>
            </li>
          </ul>

          <div className="mt-4 rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-[12px] font-medium text-foreground">
              Mẹo khởi tạo nhanh
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Tên, slug, ảnh bìa và mô hình giá là 4 trường nên chốt sớm để bước chỉnh sửa sau nhanh hơn.
            </p>
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <section className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  Thông tin chung
                </h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">
                  Điền thông tin cơ bản. Sau khi tạo, bạn sẽ được chuyển sang trang
                  chỉnh sửa để thêm chương, bài học và các cấu hình nâng cao.
                </p>
              </div>
              <div className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                Bước bắt đầu
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel>Tên khoá học</FieldLabel>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, title: e.target.value }))
                    }
                    onBlur={handleSlugFromTitle}
                    placeholder="Ví dụ: React từ cơ bản đến nâng cao"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Slug</FieldLabel>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, slug: e.target.value }))
                    }
                    placeholder="react-tu-co-ban-den-nang-cao"
                  />
                </Field>
                <Field>
                  <FieldLabel>Mô tả ngắn</FieldLabel>
                  <Input
                    value={form.short_description}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        short_description: e.target.value,
                      }))
                    }
                    placeholder="Một dòng mô tả (tuỳ chọn)"
                  />
                </Field>
                <Field>
                  <FieldLabel>Mô tả</FieldLabel>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={4}
                    placeholder="Mô tả đầy đủ về khoá học..."
                  />
                </Field>
                <Field>
                  <FieldLabel>Ảnh bìa khoá học</FieldLabel>
                  <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleThumbnailFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingThumb}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingThumb ? "Đang tải ảnh..." : "Tải ảnh bìa lên"}
                    </Button>
                    <img
                      src={thumbnailPreviewUrl ?? form.thumbnail_url}
                      alt=""
                      className="h-20 w-32 rounded-xl border border-border-subtle object-cover"
                    />
                  </div>
                </Field>
                {showBusinessSettingsSection && (
                  <>
                    <Field>
                      <FieldLabel>Loại khoá học theo sở hữu doanh thu</FieldLabel>
                      <select
                        value={form.owner_type}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            owner_type: e.target.value as CourseOwnerType,
                          }))
                        }
                        disabled={!canManageBusinessSettings}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                      >
                        {Object.entries(COURSE_OWNER_TYPE_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      {!canManageBusinessSettings && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Chỉ học vụ/admin được đổi cấu hình sở hữu doanh thu.
                        </p>
                      )}
                    </Field>
                    {form.owner_type === "external_partner" && (
                      <Field>
                        <FieldLabel>Tỷ lệ doanh thu nền tảng (%)</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={form.platform_revenue_share_percent}
                          disabled={!canManageBusinessSettings}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              platform_revenue_share_percent: e.target.value,
                            }))
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Phần còn lại thuộc giảng viên đối tác.
                        </p>
                      </Field>
                    )}
                  </>
                )}
                <Field>
                  <FieldLabel>Loại khoá học</FieldLabel>
                  <select
                    value={form.access_model}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        access_model: e.target.value as CourseAccessModel,
                      }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Object.entries(COURSE_ACCESS_MODEL_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                {form.access_model === "paid_upfront" && (
                  <Field>
                    <FieldLabel>Giá khoá học (VND)</FieldLabel>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatVndInput(form.price_vnd)}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          price_vnd: normalizeVndDigits(e.target.value),
                        }))
                      }
                      placeholder="Ví dụ: 499.000"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Đơn vị VND (đ), tự động định dạng khi nhập.
                    </p>
                  </Field>
                )}
                {form.access_model === "free_with_paid_certificate" && (
                  <Field>
                    <FieldLabel>Phí chứng nhận / bài thu hoạch (VND)</FieldLabel>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatVndInput(form.certificate_fee_vnd)}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          certificate_fee_vnd: normalizeVndDigits(
                            e.target.value,
                          ),
                        }))
                      }
                      placeholder="Ví dụ: 199.000"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Đơn vị VND (đ), tự động định dạng khi nhập.
                    </p>
                  </Field>
                )}
                <Field>
                  <FieldLabel>Cấp độ</FieldLabel>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        level: e.target.value as CourseLevel,
                      }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Object.entries(COURSE_LEVEL_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          published: e.target.checked,
                        }))
                      }
                      className="rounded border-input"
                    />
                    <span className="text-[13px] font-medium text-foreground">
                      Đã xuất bản (hiển thị trên trang Khoá học)
                    </span>
                  </label>
                </Field>
              </FieldGroup>

              <div className="mt-4 flex gap-3">
                <Button type="submit" disabled={saving || uploadingThumb}>
                  {saving ? "Đang tạo..." : "Tạo khoá học"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/instructor/courses")}
                  disabled={saving || uploadingThumb}
                >
                  Huỷ
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default InstructorCourseNew;
