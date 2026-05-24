import {
  Award,
  AlertTriangle,
  FileText,
  List,
  Settings,
  Users,
  XCircle,
  Plus,
} from "lucide-react";
import {
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  getCourseOwnerTypeLabel,
  type CourseOwnerType,
  type CourseAccessModel,
  type CourseLevel,
} from "@/types/courses";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";

import { useInstructorCourseNewForm } from "./hooks/useInstructorCourseNewForm";
import { formatVndInput, normalizeVndDigits } from "./utils/currency";

export default function InstructorCourseNewPage() {
  const {
    t,
    profile,
    navigate,
    saving,
    uploadingThumb,
    error,
    fileInputRef,
    thumbnailPreviewUrl,
    form,
    setForm,
    canManageBusinessSettings,
    showBusinessSettingsSection,
    handleThumbnailFileChange,
    handleSlugFromTitle,
    handleSubmit,
    normalizeCourseLocale,
  } = useInstructorCourseNewForm();

  return (
    <PageContainer>
      <PageSectionCard className="mb-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="max-w-3xl text-sm text-foreground-muted sm:text-sm">
              Thiết lập nhanh cấu hình khởi tạo trước khi chuyển sang màn chỉnh sửa chi tiết.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              Bước 1: Khởi tạo
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              {profile?.instructor_origin === "external"
                ? t("courseNew.labels.originExternal")
                : t("courseNew.labels.originCorelia")}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Trạng thái
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {t("courseNew.labels.draft")}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Loại truy cập
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {getCourseAccessModelLabel(form.access_model)}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Sở hữu doanh thu
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {getCourseOwnerTypeLabel(form.owner_type)}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Cấp độ
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {getCourseLevelLabel(form.level)}
            </p>
          </div>
        </div>
      </PageSectionCard>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <nav className="h-fit rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 xl:sticky xl:top-24">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Lộ trình thiết lập
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              Sau bước khởi tạo này, bạn sẽ tiếp tục hoàn thiện nội dung và cấu hình nâng cao.
              
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2 text-left text-sm font-medium text-sidebar-accent-foreground"
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                Thông tin chung
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground-muted opacity-60"
              >
                <List className="size-4 shrink-0" aria-hidden />
                Nội dung & bài học
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground-muted opacity-60"
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                Bài tập cuối khoá
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground-muted opacity-60"
              >
                <Award className="size-4 shrink-0" aria-hidden />
                Chứng nhận
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground-muted opacity-60"
              >
                <Users className="size-4 shrink-0" aria-hidden />
                Quản lý học viên
              </button>
            </li>
            <li className="border-t border-border-subtle mt-2 pt-2">
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground-muted opacity-60"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                Xoá khoá học
              </button>
            </li>
          </ul>

          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-raised p-4">
            <p className="text-xs font-medium text-foreground">
              Mẹo khởi tạo nhanh
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              Tên, slug, ảnh bìa và mô hình giá là 4 trường nên chốt sớm để bước chỉnh sửa sau nhanh hơn.
            </p>
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <PageSectionCard className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  Thông tin chung
                </h2>
                <p className="mt-2 text-sm text-foreground-muted">
                  Điền thông tin cơ bản. Sau khi tạo, bạn sẽ được chuyển sang trang
                  chỉnh sửa để thêm chương, bài học và các cấu hình nâng cao.
                </p>
              </div>
              <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                Bước bắt đầu
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel>{t("courseNew.labels.contentLocales" as never)}</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["vi", "en"] as const).map((loc) => {
                      const enabled = form.supported_locales.includes(loc);
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() =>
                            setForm((p) => {
                              const next = new Set(p.supported_locales);
                              if (next.has(loc)) next.delete(loc);
                              else next.add(loc);
                              const result = Array.from(next);
                              if (result.length === 0) return p;
                              const primaryOk = result.includes(p.primary_content_locale);
                              const primary = primaryOk
                                ? p.primary_content_locale
                                : normalizeCourseLocale(result[0]);
                              return { ...p, supported_locales: result, primary_content_locale: primary };
                            })
                          }
                          className={`rounded-md border px-2 py-1 text-xs font-medium ${
                            enabled
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border-subtle bg-surface-base text-foreground-muted"
                          }`}
                        >
                          {loc.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("courseNew.labels.contentLocalesHint" as never)}
                  </p>
                </Field>
                <Field>
                  <FieldLabel>{t("courseNew.labels.primaryContentLocale" as never)}</FieldLabel>
                  <select
                    value={form.primary_content_locale}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        primary_content_locale: normalizeCourseLocale(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  >
                    {form.supported_locales.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>{t("courseNew.labels.defaultVideoLocale" as never)}</FieldLabel>
                  <select
                    value={form.default_video_primary_locale}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        default_video_primary_locale: normalizeCourseLocale(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  >
                    {(["vi", "en"] as const).map((loc) => (
                      <option key={loc} value={loc}>
                        {loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>{t("courseNew.labels.title")}</FieldLabel>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, title: e.target.value }))
                    }
                    onBlur={handleSlugFromTitle}
                    placeholder={t("courseNew.placeholders.title")}
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
                  <FieldLabel>{t("courseNew.labels.shortDescription")}</FieldLabel>
                  <Input
                    value={form.short_description}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        short_description: e.target.value,
                      }))
                    }
                    placeholder={t("courseNew.placeholders.shortDescription")}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseNew.labels.description")}</FieldLabel>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("courseNew.labels.descriptionMarkdownHint")}
                  </p>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    className="min-h-[140px] w-full rounded-lg border border-border bg-surface-base px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    rows={4}
                    placeholder={t("courseNew.placeholders.description")}
                  />
                </Field>
                <Field>
                  <FieldLabel>Sources (external URLs)</FieldLabel>
                  <textarea
                    value={form.external_source_urls_text}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        external_source_urls_text: e.target.value,
                      }))
                    }
                    className="min-h-[100px] w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    rows={4}
                    placeholder={"Mỗi dòng 1 URL nguồn\nhttps://youtube.com/...\nhttps://youtube.com/..."}
                  />
                </Field>
                <Field>
                  <FieldLabel>Source attribution note</FieldLabel>
                  <textarea
                    value={form.external_source_attribution_note}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        external_source_attribution_note: e.target.value,
                      }))
                    }
                    className="min-h-[80px] w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    rows={3}
                    placeholder="Ghi chú công khai về nguồn tổng hợp (ví dụ: curated từ playlist YouTube của các creator)."
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseNew.labels.learningOutcomes")}</FieldLabel>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("courseNew.labels.learningOutcomesSubtitle")}
                  </p>
                  <div className="mt-3 space-y-2">
                    {(form.learning_outcomes ?? []).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={item}
                          onChange={(e) =>
                            setForm((p) => {
                              const next = [...(p.learning_outcomes ?? [])];
                              next[idx] = e.target.value;
                              return { ...p, learning_outcomes: next };
                            })
                          }
                          placeholder={t("courseNew.placeholders.learningOutcomesItem")}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() =>
                            setForm((p) => {
                              const next = [...(p.learning_outcomes ?? [])];
                              next.splice(idx, 1);
                              return { ...p, learning_outcomes: next };
                            })
                          }
                        >
                          <XCircle className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 inline-flex items-center gap-2"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        learning_outcomes: [...(p.learning_outcomes ?? []), ""],
                      }))
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    {t("courseNew.labels.learningOutcomesAdd")}
                  </Button>
                </Field>
                <Field>
                  <FieldLabel>{t("courseNew.labels.thumbnail")}</FieldLabel>
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
                      {uploadingThumb
                        ? t("courseNew.actions.uploadingThumb")
                        : t("courseNew.actions.uploadThumb")}
                    </Button>
                    <img
                      src={thumbnailPreviewUrl ?? form.thumbnail_url}
                      alt=""
                      className="h-20 w-32 rounded-md border border-border-subtle object-cover"
                    />
                  </div>
                </Field>
                {showBusinessSettingsSection && (
                  <>
                    <Field>
                      <FieldLabel>{t("courseNew.labels.ownerType")}</FieldLabel>
                      <select
                        value={form.owner_type}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            owner_type: e.target.value as CourseOwnerType,
                          }))
                        }
                        disabled={!canManageBusinessSettings}
                        className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60"
                      >
                        {(
                          [
                            ["corelia", getCourseOwnerTypeLabel("corelia")],
                            ["external_partner", getCourseOwnerTypeLabel("external_partner")],
                          ] as const
                        ).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {!canManageBusinessSettings && (
                        <p className="mt-1 text-xs text-foreground-muted">
                          Chỉ học vụ/admin được đổi cấu hình sở hữu doanh thu.
                        </p>
                      )}
                    </Field>
                    {form.owner_type === "external_partner" && (
                      <Field>
                        <FieldLabel>{t("courseNew.labels.platformRevenueSharePercent")}</FieldLabel>
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
                        <p className="mt-1 text-xs text-foreground-muted">
                          Phần còn lại thuộc giảng viên đối tác.
                        </p>
                      </Field>
                    )}
                  </>
                )}
                <Field>
                  <FieldLabel>{t("courseNew.labels.accessModel")}</FieldLabel>
                  <select
                    value={form.access_model}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        access_model: e.target.value as CourseAccessModel,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  >
                    {(
                      [
                        ["free", getCourseAccessModelLabel("free")],
                        ["paid_upfront", getCourseAccessModelLabel("paid_upfront")],
                        [
                          "free_with_paid_certificate",
                          getCourseAccessModelLabel("free_with_paid_certificate"),
                        ],
                      ] as const
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.access_model === "paid_upfront" && (
                  <Field>
                    <FieldLabel>{t("courseNew.labels.priceVnd")}</FieldLabel>
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
                      placeholder={t("courseNew.placeholders.priceVnd")}
                    />
                    <p className="mt-1 text-xs text-foreground-muted">
                      Đơn vị VND (đ), tự động định dạng khi nhập.
                    </p>
                  </Field>
                )}
                {form.access_model === "free_with_paid_certificate" && (
                  <Field>
                    <FieldLabel>{t("courseNew.labels.certificateFeeVnd")}</FieldLabel>
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
                      placeholder={t("courseNew.placeholders.certificateFeeVnd")}
                    />
                    <p className="mt-1 text-xs text-foreground-muted">
                      Đơn vị VND (đ), tự động định dạng khi nhập.
                    </p>
                  </Field>
                )}
                <Field>
                  <FieldLabel>{t("courseNew.labels.level")}</FieldLabel>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        level: e.target.value as CourseLevel,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  >
                    {(
                      [
                        ["beginner", getCourseLevelLabel("beginner")],
                        ["intermediate", getCourseLevelLabel("intermediate")],
                        ["advanced", getCourseLevelLabel("advanced")],
                        ["all", getCourseLevelLabel("all")],
                      ] as const
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
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
                      className="rounded border-border"
                    />
                    <span className="text-sm font-medium text-foreground">
                      Đã xuất bản (hiển thị trên trang Khoá học)
                    </span>
                  </label>
                </Field>
                <Field>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_external_aggregated}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          is_external_aggregated: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded border-border"
                    />
                    <span className="text-sm text-foreground">
                      <span className="font-medium">Public external course</span>
                      <span className="mt-1 block text-xs text-foreground-muted">
                        Course này tổng hợp nội dung từ nguồn bên ngoài (YouTube/reference link tới kênh của creator).
                      </span>
                    </span>
                  </label>
                </Field>
              </FieldGroup>

              <div className="mt-4 flex gap-3">
                <Button type="submit" disabled={saving || uploadingThumb}>
                  {saving ? t("courseNew.actions.creating") : t("courseNew.actions.create")}
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
          </PageSectionCard>
        </div>
      </div>
    </PageContainer>
  );

}
