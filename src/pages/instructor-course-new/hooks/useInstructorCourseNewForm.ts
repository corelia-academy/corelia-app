import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  createCourse,
  normalizeCourseLocale,
  setCourseLocaleContent,
  updateCourse,
} from "@/lib/courses";
import { uploadCourseThumbnail } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type {
  CourseAccessModel,
  CourseLevel,
  CourseOwnerType,
  SupportedCourseLocale,
} from "@/types/courses";

export function useInstructorCourseNewForm() {
  const { t } = useTranslation("instructor");
  const { profile, user } = useAuth();
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
    supported_locales: ["vi", "en"] as SupportedCourseLocale[],
    primary_content_locale: "vi" as SupportedCourseLocale,
    default_video_primary_locale: "vi" as SupportedCourseLocale,
    title: "",
    slug: "",
    description: "",
    learning_outcomes: [] as string[],
    short_description: "",
    thumbnail_url:
      "https://placehold.co/640x360/1e3a5f/fff?text=Kho%C3%A1+h%E1%BB%8Dc",
    level: "all" as CourseLevel,
    published: false,
    is_external_aggregated: false,
    external_source_urls_text: "",
    external_source_attribution_note: "",
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
      setError(t("courseNew.errors.missingProfileName"));
      return;
    }
    if (!form.title.trim()) {
      setError(t("courseNew.errors.missingTitle"));
      return;
    }
    if (form.access_model === "paid_upfront" && Number(form.price_vnd) <= 0) {
      setError(t("courseNew.errors.invalidPaidPrice"));
      return;
    }
    if (
      form.access_model === "free_with_paid_certificate" &&
      Number(form.certificate_fee_vnd) <= 0
    ) {
      setError(t("courseNew.errors.invalidCertificateFee"));
      return;
    }
    if (
      form.owner_type === "external_partner" &&
      (Number(form.platform_revenue_share_percent) < 0 ||
        Number(form.platform_revenue_share_percent) > 100)
    ) {
      setError(t("courseNew.errors.invalidRevenueShare"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sanitizedOutcomes = (form.learning_outcomes ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((item) => (item.length > 140 ? item.slice(0, 140) : item));

      const course = await createCourse(
        {
          title: form.title.trim(),
          slug:
            form.slug.trim() ||
            form.title.trim().toLowerCase().replace(/\s+/g, "-"),
          description: form.description.trim(),
          learning_outcomes: sanitizedOutcomes,
          short_description: form.short_description.trim() || "",
          thumbnail_url: form.thumbnail_url.trim(),
          instructor_id: profile.id,
          instructor_name: profile.full_name,
          level: form.level,
          total_duration_seconds: 0,
          published: form.published,
          is_external_aggregated: form.is_external_aggregated,
          external_source_urls: form.external_source_urls_text
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          external_source_attribution_note:
            form.external_source_attribution_note.trim() || null,
          i18n: {
            supported_locales: form.supported_locales,
            primary_content_locale: form.primary_content_locale,
            default_video_primary_locale: form.default_video_primary_locale,
            subtitle_note_policy: "suggest",
          },
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
        },
        user ?? undefined,
      );

      await setCourseLocaleContent(course.id, form.primary_content_locale, {
        title: form.title.trim(),
        description: form.description.trim(),
        short_description: form.short_description.trim() || "",
        learning_outcomes: sanitizedOutcomes,
        slug: form.slug.trim() || undefined,
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

      toast.success(t("courseNew.toasts.created"));
      navigate(`/instructor/courses/${course.id}/edit`, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("courseNew.errors.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return {
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
  };
}
