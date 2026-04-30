import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Plus,
  List,
  PlayCircle,
  Users,
  FileText,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Award,
  AlertTriangle,
  CheckCircle2,
  Download,
  GripVertical,
  Loader2,
  Settings,
  DollarSign,
  Trash2,
} from "lucide-react";
import {
  getCourse,
  getCourseSections,
  getCourseLessons,
  getEnrollmentsForCourse,
  getLessonProgressForCourse,
  computeProgressPercent,
  checkAndIssueCertificate,
  updateCourse,
  isCourseCoInstructorWithAnyPermission,
  toCoInstructorSnapshot,
  applyCourseLessonLocaleContent,
  applyCourseSectionLocaleContent,
  backfillCourseLocaleIndex,
  getCourseLessonLocaleContent,
  getCourseLocaleContent,
  getCoursePrimaryLocale,
  getCourseSectionLocaleContent,
  getCourseSupportedLocales,
  normalizeCourseLocale,
  setCourseLessonLocaleContent,
  setCourseLocaleContent,
  setCourseSectionLocaleContent,
  addSection,
  addLesson,
  updateSection,
  updateLesson,
  reorderCourseLessons,
  deleteSection,
  deleteLesson,
  deleteCourse,
  refreshCourseTotalDuration,
  sortLessonsByCurriculum,
} from "@/lib/courses";
import {
  getSubmissionsForCourse,
  updateSubmissionStatus,
} from "@/lib/finalAssignment";
import {
  getAllProfiles,
  getProfile,
  listCoreliaInstructorProfiles,
} from "@/lib/profile";
import { getYoutubeVideoDuration } from "@/lib/youtube";
import {
  createCourseDiscount,
  deleteCourseDiscount as deleteCourseDiscountCode,
  listCourseDiscounts,
  setCourseDiscountActive,
  type CourseDiscount,
  type CourseDiscountType,
} from "@/lib/discounts";
import {
  uploadCourseThumbnail,
  uploadCoursePartnerDocument,
  uploadCertificateTemplate,
} from "@/lib/storage";
import {
  getCourseOwnerTypeLabel,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  formatVndPrice,
  formatDuration,
  type PartnerCourseDocument,
  type CourseOwnerType,
  type CourseAccessModel,
  type CourseLevel,
  type SupportedCourseLocale,
  type CourseCoInstructorPermissionKey,
  type CourseCoInstructorPermissions,
} from "@/types/courses";
import type {
  Course,
  CourseSection,
  CourseLesson,
  Enrollment,
  FinalAssignmentSubmission,
} from "@/types/courses";
import type { Profile } from "@/types/database";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ProfileCombobox,
  type ProfileComboboxOption,
} from "@/components/ui/profile-combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Markdown } from "@/components/markdown/Markdown";

const normalizeVndDigits = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const formatVndInput = (value: string) =>
  value ? Number(value).toLocaleString(intlLocale()) : "";

const EDIT_SECTION_IDS = [
  "info",
  "pricing",
  "content",
  "assignments",
  "certificate",
  "students",
  "danger",
] as const;

const CO_INSTRUCTOR_PERMISSION_KEYS: Array<{
  key: CourseCoInstructorPermissionKey;
  labelKey: string;
}> = [
  { key: "students", labelKey: "courseEdit.coInstructors.permissions.students" },
  { key: "submissions", labelKey: "courseEdit.coInstructors.permissions.submissions" },
  { key: "content", labelKey: "courseEdit.coInstructors.permissions.content" },
  { key: "certificates", labelKey: "courseEdit.coInstructors.permissions.certificates" },
  { key: "pricing", labelKey: "courseEdit.coInstructors.permissions.pricing" },
];

type LessonDropPosition = "before" | "after";

type LessonDropTarget = {
  sectionId: string;
  lessonId: string;
  position: LessonDropPosition;
};

const getNextOrder = (items: Array<{ order?: number | null }>) =>
  items.reduce((max, item) => Math.max(max, Number(item.order ?? -1)), -1) + 1;

const InstructorCourseEdit = () => {
  const { t } = useTranslation("instructor");
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<
    Record<string, Profile | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingTotal, setRefreshingTotal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [editingSectionDescription, setEditingSectionDescription] = useState("");
  const [addingLessonInProgress, setAddingLessonInProgress] = useState(false);
  const [reorderingLessons, setReorderingLessons] = useState(false);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [draggingLessonSectionId, setDraggingLessonSectionId] = useState<
    string | null
  >(null);
  const [lessonDropTarget, setLessonDropTarget] =
    useState<LessonDropTarget | null>(null);
  const [addingLessonDraftSectionId, setAddingLessonDraftSectionId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonShortDescription, setNewLessonShortDescription] = useState("");
  const [newLessonYoutubeUrl, setNewLessonYoutubeUrl] = useState("");
  const [newLessonMinutes, setNewLessonMinutes] = useState<number | "">("");
  const [newLessonIsPreviewFree, setNewLessonIsPreviewFree] = useState(false);
  const [newLessonMarkdown, setNewLessonMarkdown] = useState("");
  const [newLessonResources, setNewLessonResources] = useState<
    Array<{ title: string; url: string }>
  >([]);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState("");
  const [editingLessonYoutubeUrl, setEditingLessonYoutubeUrl] = useState("");
  const [editingLessonVideoPrimaryLocale, setEditingLessonVideoPrimaryLocale] =
    useState<SupportedCourseLocale>("vi");
  const [editingLessonHasSubtitle, setEditingLessonHasSubtitle] = useState(false);
  const [editingLessonSubtitleLocales, setEditingLessonSubtitleLocales] = useState<
    SupportedCourseLocale[]
  >([]);
  const [editingLessonShortDescription, setEditingLessonShortDescription] = useState("");
  const [editingLessonMarkdown, setEditingLessonMarkdown] = useState("");
  const [editingLessonResources, setEditingLessonResources] = useState<
    Array<{ title: string; url: string }>
  >([]);
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [form, setForm] = useState({
    slug: "",
    thumbnail_url: "",
    level: "all" as CourseLevel,
    published: false,
    is_updating: false,
    certificate_template_url: "",
    certificate_template_path: "",
    certificate_name_x_percent: 50,
    certificate_name_y_percent: 50,
    access_model: "free" as CourseAccessModel,
    price_vnd: "",
    promo_price_vnd: "",
    promo_ends_at: "",
    certificate_fee_vnd: "",
    owner_type: "corelia" as CourseOwnerType,
    platform_revenue_share_percent: "100",
    partner_contract_docs: [] as PartnerCourseDocument[],
    partner_invoice_docs: [] as PartnerCourseDocument[],
    partner_transfer_info: "",
  });

  const [coInstructorIds, setCoInstructorIds] = useState<string[]>([]);
  const [coInstructorPermissions, setCoInstructorPermissions] = useState<
    Record<string, CourseCoInstructorPermissions>
  >({});
  const [instructorDirectory, setInstructorDirectory] = useState<Profile[]>([]);
  const [loadingInstructorDirectory, setLoadingInstructorDirectory] =
    useState(false);

  const [supportedLocales, setSupportedLocales] = useState<SupportedCourseLocale[]>(["vi", "en"]);
  const [primaryContentLocale, setPrimaryContentLocale] = useState<SupportedCourseLocale>("vi");
  const [defaultVideoPrimaryLocale, setDefaultVideoPrimaryLocale] =
    useState<SupportedCourseLocale>("vi");
  const [activeContentLocale, setActiveContentLocale] = useState<SupportedCourseLocale>("vi");
  const [contentForm, setContentForm] = useState({
    title: "",
    short_description: "",
    description: "",
    learning_outcomes: [] as string[],
    final_assignment_title: "",
    final_assignment_description: "",
    final_assignment_instructions: "",
  });
  const [submissions, setSubmissions] = useState<FinalAssignmentSubmission[]>(
    [],
  );
  const [studentProgress, setStudentProgress] = useState<
    Record<string, number>
  >({});
  const [submissionByUser, setSubmissionByUser] = useState<
    Record<string, FinalAssignmentSubmission>
  >({});
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const certificateInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingContractDoc, setUploadingContractDoc] = useState(false);
  const [uploadingInvoiceDoc, setUploadingInvoiceDoc] = useState(false);
  const [discounts, setDiscounts] = useState<CourseDiscount[]>([]);
  const [backfillingLocales, setBackfillingLocales] = useState(false);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [creatingDiscount, setCreatingDiscount] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    code: "",
    type: "percent" as CourseDiscountType,
    value: "",
    starts_at: "",
    ends_at: "",
    max_redemptions: "",
  });

  type SectionId =
    | "info"
    | "pricing"
    | "content"
    | "assignments"
    | "certificate"
    | "students"
    | "danger";
  const sectionIds = EDIT_SECTION_IDS as readonly SectionId[];
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    return (
      sectionIds.includes(hash as SectionId) ? hash : "info"
    ) as SectionId;
  });

  const setSection = (id: SectionId) => {
    setActiveSection(id);
    window.location.hash = id;
  };

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (sectionIds.includes(hash as SectionId))
        setActiveSection(hash as SectionId);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [sectionIds]);

  const isAdmin = profile?.role === "admin";
  const isSupportStaff = profile?.role === "support_staff";
  const canManageBusinessSettings = isAdmin || isSupportStaff;
  const showBusinessSettingsSection =
    canManageBusinessSettings || profile?.instructor_origin !== "external";
  const canEdit =
    course && (isAdmin || isSupportStaff || course.instructor_id === profile?.id);

  const coInstructorPermsEffective: CourseCoInstructorPermissions =
    (course &&
      profile?.id &&
      course.co_instructor_permissions?.[profile.id]) ||
    {};
  const canAccessEditor = Boolean(
    course &&
      (canEdit ||
        isCourseCoInstructorWithAnyPermission(course, profile?.id)),
  );

  const canAccessInfo = Boolean(canEdit);
  const canAccessPricing = Boolean(canEdit || coInstructorPermsEffective.pricing);
  const canAccessContent = Boolean(canEdit || coInstructorPermsEffective.content);
  const canAccessAssignments = Boolean(
    canEdit || coInstructorPermsEffective.submissions,
  );
  const canAccessCertificate = Boolean(
    canEdit || coInstructorPermsEffective.certificates,
  );
  const canAccessStudents = Boolean(
    canEdit || coInstructorPermsEffective.students,
  );
  const canAccessDanger = Boolean(canEdit);

  useEffect(() => {
    const allowed: SectionId[] = [];
    if (canAccessInfo) allowed.push("info");
    if (canAccessPricing) allowed.push("pricing");
    if (canAccessContent) allowed.push("content");
    if (canAccessAssignments) allowed.push("assignments");
    if (canAccessCertificate) allowed.push("certificate");
    if (canAccessStudents) allowed.push("students");
    if (canAccessDanger) allowed.push("danger");
    if (allowed.length === 0) return;
    if (allowed.includes(activeSection)) return;
    setSection(allowed[0]);
    // Intentionally use setSection for hash sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSection,
    canAccessInfo,
    canAccessPricing,
    canAccessContent,
    canAccessAssignments,
    canAccessCertificate,
    canAccessStudents,
    canAccessDanger,
  ]);

  const canEditCoInstructors = Boolean(
    course && (isAdmin || isSupportStaff || course.instructor_id === profile?.id),
  );

  useEffect(() => {
    if (!course) return;
    const ids =
      (course.co_instructors ?? [])
        .map((c) => String(c.id ?? "").trim())
        .filter(Boolean) ?? [];
    const filtered = ids.filter((cid) => cid !== course.instructor_id);
    setCoInstructorIds(Array.from(new Set(filtered)));
    setCoInstructorPermissions(course.co_instructor_permissions ?? {});
  }, [course]);

  useEffect(() => {
    if (!canEditCoInstructors) return;
    let cancelled = false;
    setLoadingInstructorDirectory(true);
    const load = async () => {
      if (isAdmin || isSupportStaff) {
        const all = await getAllProfiles();
        return all.filter((p) => p.role === "instructor");
      }
      return await listCoreliaInstructorProfiles();
    };
    void load()
      .then((rows) => {
        if (!cancelled) setInstructorDirectory(rows);
      })
      .catch(() => {
        if (!cancelled) setInstructorDirectory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingInstructorDirectory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canEditCoInstructors, isAdmin, isSupportStaff]);

  useEffect(() => {
    if (!id || !canAccessPricing) return;
    let cancelled = false;
    setLoadingDiscounts(true);
    listCourseDiscounts(id)
      .then((rows) => {
        if (!cancelled) setDiscounts(rows);
      })
      .catch(() => {
        if (!cancelled) setDiscounts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDiscounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, canAccessPricing]);

  useEffect(() => {
    if (course) {
      setForm({
        slug: course.slug,
        thumbnail_url: course.thumbnail_url,
        level: course.level,
        published: course.published,
        is_updating: course.is_updating ?? false,
        certificate_template_url: course.certificate_template_url ?? "",
        certificate_template_path: course.certificate_template_path ?? "",
        certificate_name_x_percent: course.certificate_name_x_percent ?? 50,
        certificate_name_y_percent: course.certificate_name_y_percent ?? 50,
        access_model: course.access_model ?? "free",
        price_vnd:
          course.price_vnd && course.price_vnd > 0
            ? String(course.price_vnd)
            : "",
        promo_price_vnd:
          course.promo_price_vnd && course.promo_price_vnd > 0
            ? String(course.promo_price_vnd)
            : "",
        promo_ends_at: course.promo_ends_at ?? "",
        certificate_fee_vnd:
          course.certificate_fee_vnd && course.certificate_fee_vnd > 0
            ? String(course.certificate_fee_vnd)
            : "",
        owner_type: course.owner_type ?? "corelia",
        platform_revenue_share_percent: String(
          course.platform_revenue_share_percent ?? 100,
        ),
        partner_contract_docs: course.partner_contract_docs ?? [],
        partner_invoice_docs: course.partner_invoice_docs ?? [],
        partner_transfer_info: course.partner_transfer_info ?? "",
      });

      const supported = getCourseSupportedLocales(course);
      const primary = getCoursePrimaryLocale(course);
      const defaultVideo = normalizeCourseLocale(course.i18n?.default_video_primary_locale);
      setSupportedLocales(supported);
      setPrimaryContentLocale(primary);
      setDefaultVideoPrimaryLocale(defaultVideo);
      setActiveContentLocale((prev) => (supported.includes(prev) ? prev : primary));
    }
  }, [course]);

  useEffect(() => {
    if (!id || !course) return;
    let cancelled = false;
    const fallbackFromCourse = () => ({
      title: course.title ?? "",
      short_description: course.short_description ?? "",
      description: course.description ?? "",
      learning_outcomes: course.learning_outcomes ?? [],
      final_assignment_title: course.final_assignment_title ?? "",
      final_assignment_description: course.final_assignment_description ?? "",
      final_assignment_instructions: course.final_assignment_instructions ?? "",
    });
    setContentForm(fallbackFromCourse());
    void (async () => {
      const localized = await getCourseLocaleContent(id, activeContentLocale).catch(() => null);
      if (cancelled) return;
      if (!localized) {
        setContentForm(fallbackFromCourse());
        return;
      }
      setContentForm({
        title: localized.title ?? fallbackFromCourse().title,
        short_description: localized.short_description ?? fallbackFromCourse().short_description,
        description: localized.description ?? fallbackFromCourse().description,
        learning_outcomes: localized.learning_outcomes ?? fallbackFromCourse().learning_outcomes,
        final_assignment_title:
          (localized.final_assignment_title ?? "") || fallbackFromCourse().final_assignment_title,
        final_assignment_description:
          (localized.final_assignment_description ?? "") ||
          fallbackFromCourse().final_assignment_description,
        final_assignment_instructions:
          (localized.final_assignment_instructions ?? "") ||
          fallbackFromCourse().final_assignment_instructions,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeContentLocale, course, id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const c = await getCourse(id);
        if (cancelled) return;
        setCourse(c ?? null);
        if (!c) return;

        const isOwner = c.instructor_id === profile?.id;
        const perms = (profile?.id && c.co_instructor_permissions?.[profile.id]) || {};
        const hasAny = Object.values(perms).some(Boolean);
        const canAccess = isAdmin || isSupportStaff || isOwner || hasAny;
        if (!canAccess) return;

        const canContent = isAdmin || isSupportStaff || isOwner || perms.content === true;
        const canStudents = isAdmin || isSupportStaff || isOwner || perms.students === true;
        const canSubmissions =
          isAdmin || isSupportStaff || isOwner || perms.submissions === true;

        const [secs, less] = await Promise.all([
          canContent ? getCourseSections(id) : Promise.resolve([] as CourseSection[]),
          canContent ? getCourseLessons(id) : Promise.resolve([] as CourseLesson[]),
        ]);
        if (cancelled) return;
        setSections(secs);
        setLessons(less);

        const [enrs, subs] = await Promise.all([
          canStudents ? getEnrollmentsForCourse(id) : Promise.resolve([] as Enrollment[]),
          canSubmissions
            ? getSubmissionsForCourse(id)
            : Promise.resolve([] as FinalAssignmentSubmission[]),
        ]);
        if (cancelled) return;
        setEnrollments(enrs);
        setSubmissions(subs);

        const subByUser: Record<string, FinalAssignmentSubmission> = {};
        for (const s of subs) subByUser[s.user_id] = s;
        setSubmissionByUser(subByUser);

        if (canStudents) {
          const profiles: Record<string, Profile | null> = {};
          const progress: Record<string, number> = {};
          for (const e of enrs) {
            const [profileResult, progressResult] = await Promise.allSettled([
              getProfile(e.user_id),
              getLessonProgressForCourse(e.user_id, id),
            ]);
            const p =
              profileResult.status === "fulfilled" ? profileResult.value : null;
            const progList =
              progressResult.status === "fulfilled" ? progressResult.value : [];
            if (!cancelled) {
              profiles[e.user_id] = p;
              progress[e.user_id] = computeProgressPercent(less, progList);
            }
          }
          if (!cancelled) {
            setStudentProfiles(profiles);
            setStudentProgress(progress);
          }
        } else {
          setStudentProfiles({});
          setStudentProgress({});
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : t("courseEdit.errors.loadCourseFailed"),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isAdmin, isSupportStaff, profile?.id, t]);

  // Backfill tổng thời lượng khi mở trang (để danh sách khoá học bên ngoài hiển thị đúng)
  useEffect(() => {
    if (!id || !course || lessons.length === 0) return;
    const total = Number(course.total_duration_seconds) || 0;
    if (total > 0) return;
    refreshCourseTotalDuration(id).catch(() => {});
  }, [id, course, lessons.length]);

  const handleRefreshTotalDuration = async () => {
    if (!id) return;
    setRefreshingTotal(true);
    try {
      await refreshCourseTotalDuration(id);
      toast.success(t("courseEdit.toasts.totalDurationRefreshed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.errors.refreshTotalFailed"));
    } finally {
      setRefreshingTotal(false);
    }
  };

  const handleThumbnailFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !id || !course) return;

    setUploadingThumb(true);
    setError(null);
    try {
      const result = await uploadCourseThumbnail(
        id,
        file,
        course.thumbnail_path,
      );

      await updateCourse(id, {
        thumbnail_url: result.url,
        thumbnail_path: result.path,
      });

      setCourse((prev) =>
        prev
          ? {
              ...prev,
              thumbnail_url: result.url,
              thumbnail_path: result.path,
            }
          : prev,
      );
      setForm((p) => ({ ...p, thumbnail_url: result.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.uploadThumbnailFailed"));
    } finally {
      setUploadingThumb(false);
      e.target.value = "";
    }
  };

  const saveCourseInfo = async (successMessage = t("courseEdit.toasts.saved")) => {
    if (!id || !course) return;
    if (form.access_model === "paid_upfront" && Number(form.price_vnd) <= 0) {
      setError(t("courseEdit.errors.invalidPaidPrice"));
      return;
    }
    if (
      form.access_model === "paid_upfront" &&
      form.promo_price_vnd &&
      Number(form.promo_price_vnd) >= Number(form.price_vnd || 0)
    ) {
      setError(t("courseEdit.errors.invalidPromoPrice"));
      return;
    }
    if (form.access_model === "paid_upfront" && form.promo_ends_at) {
      const ts = Date.parse(form.promo_ends_at);
      if (!Number.isFinite(ts)) {
        setError(t("courseEdit.errors.invalidPromoEndsAt"));
        return;
      }
    }
    if (
      form.access_model === "free_with_paid_certificate" &&
      Number(form.certificate_fee_vnd) <= 0
    ) {
      setError(t("courseEdit.errors.invalidCertificateFee"));
      return;
    }
    if (
      form.owner_type === "external_partner" &&
      (Number(form.platform_revenue_share_percent) < 0 ||
        Number(form.platform_revenue_share_percent) > 100)
    ) {
      setError(t("courseEdit.errors.invalidRevenueShare"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sanitizedOutcomes = (contentForm.learning_outcomes ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((item) => (item.length > 140 ? item.slice(0, 140) : item));

      await setCourseLocaleContent(id, activeContentLocale, {
        title: contentForm.title.trim() || course.title,
        description: contentForm.description.trim() || course.description,
        short_description: contentForm.short_description.trim() || "",
        learning_outcomes: sanitizedOutcomes,
        final_assignment_title: contentForm.final_assignment_title.trim() || null,
        final_assignment_description:
          contentForm.final_assignment_description.trim() || null,
        final_assignment_instructions:
          contentForm.final_assignment_instructions.trim() || null,
      });

      const nextSupported = Array.from(
        new Set<SupportedCourseLocale>(supportedLocales),
      );
      const i18nPayload = {
        supported_locales: nextSupported,
        primary_content_locale: primaryContentLocale,
        default_video_primary_locale: defaultVideoPrimaryLocale,
        subtitle_note_policy: "suggest" as const,
      };

      const shouldUpdateRootContent = activeContentLocale === primaryContentLocale;

      const coInstructorSnapshots = (() => {
        if (!canEditCoInstructors) return undefined;
        const byId = new Map(instructorDirectory.map((p) => [p.id, p]));
        const fallbackById = new Map(
          (course.co_instructors ?? []).map((c) => [c.id, c]),
        );
        return coInstructorIds
          .filter((cid) => cid && cid !== course.instructor_id)
          .map((cid) => {
            const prof = byId.get(cid);
            if (prof) return toCoInstructorSnapshot(prof);
            const fallback = fallbackById.get(cid);
            if (fallback) return fallback;
            return { id: cid, name: cid };
          });
      })();

      const coInstructorPermissionsPayload = (() => {
        if (!canEditCoInstructors) return undefined;
        const next: Record<string, CourseCoInstructorPermissions> = {};
        for (const cid of coInstructorIds) {
          if (!cid || cid === course.instructor_id) continue;
          next[cid] = coInstructorPermissions[cid] ?? {};
        }
        return next;
      })();

      await updateCourse(id, {
        slug: form.slug,
        thumbnail_url: form.thumbnail_url,
        level: form.level,
        published: form.published,
        is_updating: form.is_updating,
        i18n: i18nPayload,
        ...(shouldUpdateRootContent && {
          title: contentForm.title.trim() || course.title,
          short_description: contentForm.short_description.trim() || undefined,
          description: contentForm.description.trim() || course.description,
          learning_outcomes: sanitizedOutcomes,
          final_assignment_title: contentForm.final_assignment_title.trim() || null,
          final_assignment_description:
            contentForm.final_assignment_description.trim() || null,
          final_assignment_instructions:
            contentForm.final_assignment_instructions.trim() || null,
        }),
        certificate_template_url: form.certificate_template_url || null,
        certificate_template_path: form.certificate_template_path || null,
        certificate_name_x_percent: form.certificate_name_x_percent,
        certificate_name_y_percent: form.certificate_name_y_percent,
        access_model: form.access_model,
        price_vnd:
          form.access_model === "paid_upfront"
            ? Number(form.price_vnd || 0)
            : null,
        promo_price_vnd:
          form.access_model === "paid_upfront"
            ? Number(form.promo_price_vnd || 0) || null
            : null,
        promo_ends_at:
          form.access_model === "paid_upfront"
            ? form.promo_ends_at.trim() || null
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
        partner_contract_docs: form.partner_contract_docs,
        partner_invoice_docs: form.partner_invoice_docs,
        partner_transfer_info:
          form.owner_type === "external_partner"
            ? form.partner_transfer_info.trim() || null
            : null,
        ...(canEditCoInstructors && {
          co_instructors: coInstructorSnapshots,
          co_instructor_permissions: coInstructorPermissionsPayload,
        }),
      });
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              slug: form.slug,
              thumbnail_url: form.thumbnail_url,
              level: form.level,
              published: form.published,
              is_updating: form.is_updating,
              i18n: i18nPayload,
              ...(shouldUpdateRootContent && {
                title: contentForm.title.trim() || prev.title,
                short_description: contentForm.short_description,
                description: contentForm.description,
                learning_outcomes: sanitizedOutcomes,
                final_assignment_title: contentForm.final_assignment_title,
                final_assignment_description: contentForm.final_assignment_description,
                final_assignment_instructions: contentForm.final_assignment_instructions,
              }),
              certificate_template_url: form.certificate_template_url,
              certificate_template_path: form.certificate_template_path,
              certificate_name_x_percent: form.certificate_name_x_percent,
              certificate_name_y_percent: form.certificate_name_y_percent,
              access_model: form.access_model,
              price_vnd:
                form.access_model === "paid_upfront"
                  ? Number(form.price_vnd || 0)
                  : null,
              promo_price_vnd:
                form.access_model === "paid_upfront"
                  ? Number(form.promo_price_vnd || 0) || null
                  : null,
              promo_ends_at:
                form.access_model === "paid_upfront"
                  ? form.promo_ends_at.trim() || null
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
              partner_contract_docs: form.partner_contract_docs,
              partner_invoice_docs: form.partner_invoice_docs,
              partner_transfer_info:
                form.owner_type === "external_partner"
                  ? form.partner_transfer_info.trim() || null
                  : null,
              ...(canEditCoInstructors && {
                co_instructors: coInstructorSnapshots ?? prev.co_instructors ?? [],
                co_instructor_permissions:
                  coInstructorPermissionsPayload ?? prev.co_instructor_permissions ?? {},
              }),
              updated_at: new Date().toISOString(),
            }
          : null,
      );
      toast.success(successMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleReviewSubmission = async (
    submissionId: string,
    status: "approved" | "rejected",
    comment?: string,
  ) => {
    setReviewingSubmissionId(submissionId);
    try {
      await updateSubmissionStatus(submissionId, status, comment || null);
      const sub = submissions.find((s) => s.id === submissionId);
      if (sub) {
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId
              ? { ...s, status, reviewer_comment: comment ?? null }
              : s,
          ),
        );
        setSubmissionByUser((prev) => ({
          ...prev,
          [sub.user_id]: { ...sub, status, reviewer_comment: comment ?? null },
        }));
      }
      if (status === "approved" && sub) {
        const issued = await checkAndIssueCertificate(sub.user_id, id ?? "");
        if (issued) {
          setEnrollments((prev) =>
            prev.map((e) =>
              e.user_id === sub.user_id
                ? { ...e, certificate_issued_at: new Date().toISOString() }
                : e,
            ),
          );
        }
      }
      toast.success(
        status === "approved"
          ? t("courseEdit.toasts.assignmentApproved")
          : t("courseEdit.toasts.assignmentRejected"),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.errors.processFailed"));
    } finally {
      setReviewingSubmissionId(null);
    }
  };

  const handleCertificateTemplateChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !id || !course) return;
    setUploadingCert(true);
    setError(null);
    try {
      const result = await uploadCertificateTemplate(
        id,
        file,
        course.certificate_template_path,
      );
      await updateCourse(id, {
        certificate_template_url: result.url,
        certificate_template_path: result.path,
      });
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              certificate_template_url: result.url,
              certificate_template_path: result.path,
            }
          : prev,
      );
      setForm((p) => ({
        ...p,
        certificate_template_url: result.url,
        certificate_template_path: result.path,
      }));
      toast.success(t("courseEdit.toasts.certTemplateUploaded"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("courseEdit.errors.uploadCertTemplateFailed"),
      );
    } finally {
      setUploadingCert(false);
      e.target.value = "";
    }
  };

  const handleUploadPartnerDocument = async (
    kind: "contract" | "invoice",
    file: File,
  ) => {
    if (!id || !profile?.id) return;
    if (kind === "contract") setUploadingContractDoc(true);
    else setUploadingInvoiceDoc(true);
    setError(null);
    try {
      const uploaded = await uploadCoursePartnerDocument(id, kind, file);
      const nextDoc: PartnerCourseDocument = {
        name: file.name,
        url: uploaded.url,
        path: uploaded.path,
        uploaded_at: new Date().toISOString(),
        uploaded_by: profile.id,
      };
      setForm((prev) => ({
        ...prev,
        partner_contract_docs:
          kind === "contract"
            ? [...prev.partner_contract_docs, nextDoc]
            : prev.partner_contract_docs,
        partner_invoice_docs:
          kind === "invoice"
            ? [...prev.partner_invoice_docs, nextDoc]
            : prev.partner_invoice_docs,
      }));
      toast.success(
        kind === "contract"
          ? t("courseEdit.toasts.partnerContractUploaded")
          : t("courseEdit.toasts.partnerInvoiceUploaded"),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("courseEdit.errors.uploadPartnerDocsFailed"),
      );
    } finally {
      if (kind === "contract") setUploadingContractDoc(false);
      else setUploadingInvoiceDoc(false);
    }
  };

  const handleAddSection = async () => {
    if (!id || !newSectionTitle.trim()) return;
    setAddingSection(true);
    try {
      const sec = await addSection(id, {
        title: newSectionTitle.trim(),
        description: newSectionDescription.trim() || undefined,
        order: getNextOrder(sections),
      });
      if (activeContentLocale !== primaryContentLocale) {
        await setCourseSectionLocaleContent(id, sec.id, activeContentLocale, {
          title: newSectionTitle.trim(),
          description: newSectionDescription.trim() || undefined,
        });
        setSections((prev) => [
          ...prev,
          applyCourseSectionLocaleContent(sec, {
            locale: activeContentLocale,
            title: newSectionTitle.trim(),
            description: newSectionDescription.trim() || undefined,
          }),
        ]);
      } else {
      setSections((prev) => [...prev, sec]);
      }
      setNewSectionTitle("");
      setNewSectionDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.addSectionFailed"));
    } finally {
      setAddingSection(false);
    }
  };

  const openEditSection = (section: CourseSection) => {
    setEditingSection(section);
    setEditingSectionTitle(section.title ?? "");
    setEditingSectionDescription(section.description ?? "");
    if (!id) return;
    if (activeContentLocale === primaryContentLocale) return;
    void (async () => {
      const localized = await getCourseSectionLocaleContent(id, section.id, activeContentLocale).catch(() => null);
      if (!localized) return;
      setEditingSectionTitle(localized.title ?? section.title ?? "");
      setEditingSectionDescription(localized.description ?? section.description ?? "");
    })();
  };

  const handleSaveSectionDetails = async () => {
    if (!id || !editingSection) return;
    try {
      if (activeContentLocale === primaryContentLocale) {
        await updateSection(id, editingSection.id, {
          title: editingSectionTitle.trim() || editingSection.title,
          description: editingSectionDescription.trim() || undefined,
        });
        setSections((prev) =>
          prev.map((s) =>
            s.id === editingSection.id
              ? {
                  ...s,
                  title: editingSectionTitle.trim() || s.title,
                  description: editingSectionDescription.trim() || undefined,
                }
              : s,
          ),
        );
      } else {
        await setCourseSectionLocaleContent(id, editingSection.id, activeContentLocale, {
          title: editingSectionTitle.trim() || editingSection.title,
          description: editingSectionDescription.trim() || undefined,
        });
        setSections((prev) =>
          prev.map((s) =>
            s.id === editingSection.id
              ? applyCourseSectionLocaleContent(s, {
                  locale: activeContentLocale,
                  title: editingSectionTitle.trim() || s.title,
                  description: editingSectionDescription.trim() || undefined,
                })
              : s,
          ),
        );
      }
      setEditingSection(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.updateFailed"));
    }
  };

  const handleAddLesson = async (sectionId: string) => {
    if (!id) return;
    const secLessons = lessons.filter((l) => l.section_id === sectionId);
    setAddingLessonInProgress(true);
    try {
      const youtubeUrl = newLessonYoutubeUrl.trim();
      const fromApi = youtubeUrl
        ? await getYoutubeVideoDuration(youtubeUrl)
        : 0;
      const fromInput =
        newLessonMinutes !== "" && Number(newLessonMinutes) > 0
          ? Number(newLessonMinutes) * 60
          : 0;
      const durationSeconds = fromInput > 0 ? fromInput : fromApi;
      const sanitizedResources = (newLessonResources ?? [])
        .map((r) => ({ title: (r.title ?? "").trim(), url: (r.url ?? "").trim() }))
        .filter((r) => r.title && r.url);
      const les = await addLesson(id, {
        section_id: sectionId,
        title: newLessonTitle.trim() || t("courseEdit.defaults.lessonTitle"),
        short_description: newLessonShortDescription.trim() || undefined,
        youtube_url: youtubeUrl,
        description_markdown: newLessonMarkdown.trim() || undefined,
        resources: sanitizedResources.length ? sanitizedResources : undefined,
        video_primary_locale: defaultVideoPrimaryLocale,
        has_subtitle: false,
        subtitle_locales: [],
        duration_seconds: durationSeconds || 0,
        order: getNextOrder(secLessons),
        is_preview_free:
          form.access_model === "paid_upfront" ? newLessonIsPreviewFree : false,
      });
      if (activeContentLocale !== primaryContentLocale) {
        await setCourseLessonLocaleContent(id, les.id, activeContentLocale, {
          title: newLessonTitle.trim() || t("courseEdit.defaults.lessonTitle"),
          short_description: newLessonShortDescription.trim() || undefined,
          youtube_url: youtubeUrl || undefined,
          description_markdown: newLessonMarkdown.trim() || undefined,
          resources: sanitizedResources.length ? sanitizedResources : undefined,
          video_primary_locale: defaultVideoPrimaryLocale,
          has_subtitle: false,
          subtitle_locales: [],
        });
        setLessons((prev) => [
          ...prev,
          applyCourseLessonLocaleContent(les, {
            locale: activeContentLocale,
            title: newLessonTitle.trim() || t("courseEdit.defaults.lessonTitle"),
            short_description: newLessonShortDescription.trim() || undefined,
            youtube_url: youtubeUrl || undefined,
            description_markdown: newLessonMarkdown.trim() || undefined,
            resources: sanitizedResources.length ? sanitizedResources : undefined,
            video_primary_locale: defaultVideoPrimaryLocale,
            has_subtitle: false,
            subtitle_locales: [],
          }),
        ]);
      } else {
        setLessons((prev) => [...prev, les]);
      }
      setNewLessonTitle("");
      setNewLessonShortDescription("");
      setNewLessonYoutubeUrl("");
      setNewLessonMinutes("");
      setNewLessonIsPreviewFree(false);
      setNewLessonMarkdown("");
      setNewLessonResources([]);
      setAddingLessonDraftSectionId(null);
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.addLessonFailed"));
    } finally {
      setAddingLessonInProgress(false);
    }
  };

  const openEditLesson = (lesson: CourseLesson) => {
    setEditingLesson(lesson);
    setEditingLessonTitle(lesson.title ?? "");
    setEditingLessonYoutubeUrl(lesson.youtube_url ?? "");
    setEditingLessonVideoPrimaryLocale(
      normalizeCourseLocale(lesson.video_primary_locale ?? defaultVideoPrimaryLocale),
    );
    setEditingLessonHasSubtitle(lesson.has_subtitle ?? false);
    setEditingLessonSubtitleLocales((lesson.subtitle_locales ?? []).map(normalizeCourseLocale));
    setEditingLessonShortDescription(lesson.short_description ?? "");
    setEditingLessonMarkdown(lesson.description_markdown ?? "");
    setEditingLessonResources((lesson.resources ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "" })));
    if (!id) return;
    if (activeContentLocale === primaryContentLocale) return;
    void (async () => {
      const localized = await getCourseLessonLocaleContent(id, lesson.id, activeContentLocale).catch(() => null);
      if (!localized) return;
      setEditingLessonTitle(localized.title ?? lesson.title ?? "");
      setEditingLessonYoutubeUrl(localized.youtube_url ?? lesson.youtube_url ?? "");
      setEditingLessonVideoPrimaryLocale(
        normalizeCourseLocale(localized.video_primary_locale ?? lesson.video_primary_locale ?? defaultVideoPrimaryLocale),
      );
      setEditingLessonHasSubtitle(localized.has_subtitle ?? lesson.has_subtitle ?? false);
      setEditingLessonSubtitleLocales((localized.subtitle_locales ?? lesson.subtitle_locales ?? []).map(normalizeCourseLocale));
      setEditingLessonShortDescription(localized.short_description ?? lesson.short_description ?? "");
      setEditingLessonMarkdown(localized.description_markdown ?? lesson.description_markdown ?? "");
      setEditingLessonResources((localized.resources ?? lesson.resources ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "" })));
    })();
  };

  const handleSaveLessonDetails = async () => {
    if (!id || !editingLesson) return;
    const sanitizedResources = (editingLessonResources ?? [])
      .map((r) => ({ title: (r.title ?? "").trim(), url: (r.url ?? "").trim() }))
      .filter((r) => r.title && r.url);

    try {
      if (activeContentLocale === primaryContentLocale) {
        await updateLesson(id, editingLesson.id, {
          title: editingLessonTitle.trim() || editingLesson.title,
          youtube_url: editingLessonYoutubeUrl.trim() || undefined,
          video_primary_locale: editingLessonVideoPrimaryLocale,
          has_subtitle: editingLessonHasSubtitle,
          subtitle_locales: editingLessonHasSubtitle ? editingLessonSubtitleLocales : [],
          short_description: editingLessonShortDescription.trim() || undefined,
          description_markdown: editingLessonMarkdown.trim() || undefined,
          resources: sanitizedResources.length ? sanitizedResources : undefined,
        });
        setLessons((prev) =>
          prev.map((l) =>
            l.id === editingLesson.id
              ? {
                  ...l,
                  title: editingLessonTitle.trim() || l.title,
                  youtube_url: editingLessonYoutubeUrl.trim() || undefined,
                  video_primary_locale: editingLessonVideoPrimaryLocale,
                  has_subtitle: editingLessonHasSubtitle,
                  subtitle_locales: editingLessonHasSubtitle ? editingLessonSubtitleLocales : [],
                  short_description: editingLessonShortDescription.trim() || undefined,
                  description_markdown: editingLessonMarkdown.trim() || undefined,
                  resources: sanitizedResources.length ? sanitizedResources : undefined,
                }
              : l,
          ),
        );
      } else {
        await setCourseLessonLocaleContent(id, editingLesson.id, activeContentLocale, {
          title: editingLessonTitle.trim() || editingLesson.title,
          youtube_url: editingLessonYoutubeUrl.trim() || undefined,
          video_primary_locale: editingLessonVideoPrimaryLocale,
          has_subtitle: editingLessonHasSubtitle,
          subtitle_locales: editingLessonHasSubtitle ? editingLessonSubtitleLocales : [],
          short_description: editingLessonShortDescription.trim() || undefined,
          description_markdown: editingLessonMarkdown.trim() || undefined,
          resources: sanitizedResources.length ? sanitizedResources : undefined,
        });
        setLessons((prev) =>
          prev.map((l) =>
            l.id === editingLesson.id
              ? applyCourseLessonLocaleContent(l, {
                  locale: activeContentLocale,
                  title: editingLessonTitle.trim() || l.title,
                  youtube_url: editingLessonYoutubeUrl.trim() || undefined,
                  video_primary_locale: editingLessonVideoPrimaryLocale,
                  has_subtitle: editingLessonHasSubtitle,
                  subtitle_locales: editingLessonHasSubtitle ? editingLessonSubtitleLocales : [],
                  short_description: editingLessonShortDescription.trim() || undefined,
                  description_markdown: editingLessonMarkdown.trim() || undefined,
                  resources: sanitizedResources.length ? sanitizedResources : undefined,
                })
              : l,
          ),
        );
      }
      setEditingLesson(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.updateFailed"));
    }
  };

  const handleTogglePreviewLesson = async (
    lessonId: string,
    nextValue: boolean,
  ) => {
    if (!id) return;
    try {
      await updateLesson(id, lessonId, { is_preview_free: nextValue });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId ? { ...l, is_preview_free: nextValue } : l,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.updatePreviewFailed"));
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!id || !confirm(t("courseEdit.confirm.deleteSection"))) return;
    const secLessons = lessons.filter((l) => l.section_id === sectionId);
    try {
      await deleteSection(
        id,
        sectionId,
        secLessons.map((l) => l.id),
      );
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setLessons((prev) => prev.filter((l) => l.section_id !== sectionId));
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.deleteSectionFailed"));
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!id || !confirm(t("courseEdit.confirm.deleteLesson"))) return;
    try {
      await deleteLesson(id, lessonId);
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.deleteLessonFailed"));
    }
  };

  const handleDeleteCourse = async () => {
    if (
      !id ||
      !confirm(t("courseEdit.confirm.deleteCourse"))
    )
      return;
    try {
      await deleteCourse(id);
      window.location.href = "/instructor/courses";
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.deleteCourseFailed"));
    }
  };

  const orderedSections = [...sections].sort((a, b) => {
    const orderDiff = Number(a.order ?? 0) - Number(b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.id.localeCompare(b.id);
  });

  const orderedLessons = sortLessonsByCurriculum(lessons, orderedSections);

  const lessonsBySection = orderedSections.map((sec) => ({
    section: sec,
    lessons: orderedLessons.filter((l) => l.section_id === sec.id),
  }));

  const clearLessonDragState = () => {
    setDraggingLessonId(null);
    setDraggingLessonSectionId(null);
    setLessonDropTarget(null);
  };

  const buildReorderedSectionLessons = (
    sectionId: string,
    sourceLessonId: string,
    targetLessonId: string,
    targetPosition: LessonDropPosition,
  ) => {
    if (sourceLessonId === targetLessonId) return null;

    const sectionLessons =
      lessonsBySection.find(({ section }) => section.id === sectionId)?.lessons ??
      [];
    const sourceIndex = sectionLessons.findIndex(
      (lesson) => lesson.id === sourceLessonId,
    );
    const targetIndex = sectionLessons.findIndex(
      (lesson) => lesson.id === targetLessonId,
    );
    if (sourceIndex === -1 || targetIndex === -1) return null;

    const nextSectionLessons = [...sectionLessons];
    const [movedLesson] = nextSectionLessons.splice(sourceIndex, 1);
    if (!movedLesson) return null;

    let insertIndex = targetIndex;
    if (sourceIndex < targetIndex) insertIndex -= 1;
    if (targetPosition === "after") insertIndex += 1;
    insertIndex = Math.max(0, Math.min(insertIndex, nextSectionLessons.length));

    nextSectionLessons.splice(insertIndex, 0, movedLesson);
    const unchanged = nextSectionLessons.every(
      (lesson, index) => lesson.id === sectionLessons[index]?.id,
    );
    if (unchanged) return null;

    return nextSectionLessons.map((lesson, index) => ({
      ...lesson,
      order: index,
    }));
  };

  const commitLessonOrder = async (
    sectionId: string,
    nextSectionLessons: CourseLesson[],
  ) => {
    if (!id || nextSectionLessons.length === 0) return;

    const previousLessons = lessons;
    const reorderedById = new Map(
      nextSectionLessons.map((lesson) => [lesson.id, lesson]),
    );
    const nextLessons = previousLessons.map((lesson) =>
      lesson.section_id === sectionId
        ? (reorderedById.get(lesson.id) ?? lesson)
        : lesson,
    );

    setReorderingLessons(true);
    setLessons(nextLessons);
    clearLessonDragState();

    try {
      await reorderCourseLessons(
        id,
        nextSectionLessons.map(({ id: lessonId, order, section_id }) => ({
          id: lessonId,
          order,
          section_id,
        })),
      );
    } catch (e) {
      setLessons(previousLessons);
      const message =
        e instanceof Error
          ? e.message
          : t("courseEdit.errors.reorderLessonsFailed");
      setError(message);
      toast.error(message);
    } finally {
      setReorderingLessons(false);
    }
  };

  const getLessonDropPosition = (
    event: React.DragEvent<HTMLElement>,
  ): LessonDropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top >= rect.height / 2 ? "after" : "before";
  };

  const handleMoveLesson = async (
    sectionId: string,
    lessonId: string,
    direction: -1 | 1,
  ) => {
    if (reorderingLessons) return;

    const sectionLessons =
      lessonsBySection.find(({ section }) => section.id === sectionId)?.lessons ??
      [];
    const currentIndex = sectionLessons.findIndex((lesson) => lesson.id === lessonId);
    const targetLesson = sectionLessons[currentIndex + direction];
    if (currentIndex === -1 || !targetLesson) return;

    const nextSectionLessons = buildReorderedSectionLessons(
      sectionId,
      lessonId,
      targetLesson.id,
      direction > 0 ? "after" : "before",
    );
    if (!nextSectionLessons) return;

    await commitLessonOrder(sectionId, nextSectionLessons);
  };

  const handleLessonDragStart = (
    sectionId: string,
    lessonId: string,
    event: React.DragEvent<HTMLButtonElement>,
  ) => {
    if (reorderingLessons) {
      event.preventDefault();
      return;
    }

    setDraggingLessonId(lessonId);
    setDraggingLessonSectionId(sectionId);
    setLessonDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lessonId);
  };

  const handleLessonDragOver = (
    sectionId: string,
    lessonId: string,
    event: React.DragEvent<HTMLLIElement>,
  ) => {
    if (
      reorderingLessons ||
      !draggingLessonId ||
      draggingLessonSectionId !== sectionId
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const position = getLessonDropPosition(event);
    setLessonDropTarget((current) => {
      if (
        current?.sectionId === sectionId &&
        current.lessonId === lessonId &&
        current.position === position
      ) {
        return current;
      }
      return { sectionId, lessonId, position };
    });
  };

  const handleLessonDrop = async (
    sectionId: string,
    lessonId: string,
    event: React.DragEvent<HTMLLIElement>,
  ) => {
    event.preventDefault();
    if (
      reorderingLessons ||
      !draggingLessonId ||
      draggingLessonSectionId !== sectionId
    ) {
      clearLessonDragState();
      return;
    }

    const nextSectionLessons = buildReorderedSectionLessons(
      sectionId,
      draggingLessonId,
      lessonId,
      getLessonDropPosition(event),
    );
    if (!nextSectionLessons) {
      clearLessonDragState();
      return;
    }

    await commitLessonOrder(sectionId, nextSectionLessons);
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-destructive">{error}</p>
        <Link
          to="/instructor/courses"
          className="mt-4 inline-flex items-center gap-2 text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Quay lại
        </Link>
      </div>
    );
  }

  if (!course || !canAccessEditor) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-muted-foreground">
          {t("courseEdit.access.noPermission")}
        </p>
        <Link
          to="/instructor/courses"
          className="mt-4 inline-flex items-center gap-2 text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> {t("courseEdit.access.backToTeaching")}
        </Link>
      </div>
    );
  }

  const editorStats = [
    { label: t("courseEdit.stats.sections"), value: String(sections.length), icon: List },
    { label: t("courseEdit.stats.lessons"), value: String(lessons.length), icon: PlayCircle },
    { label: t("courseEdit.stats.students"), value: String(enrollments.length), icon: Users },
    { label: t("courseEdit.stats.submissions"), value: String(submissions.length), icon: FileText },
  ];

  return (
    <PageContainer>
      <div className="mb-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
              {course.published
                ? t("courseEdit.labels.published")
                : t("courseEdit.labels.draft")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
              {getCourseAccessModelLabel(course.access_model)}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
              {getCourseLevelLabel(course.level)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {editorStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg border border-border-subtle bg-muted/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* Sidebar inner — điều hướng từng phần */}
        <nav className="h-fit shrink-0 rounded-lg border border-border-subtle bg-card p-3 shadow-card xl:sticky xl:top-24 xl:w-64">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Điều hướng chỉnh sửa
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Đi qua từng nhóm cấu hình để hoàn thiện khoá học trước khi xuất bản.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {canAccessInfo ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("info")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "info"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                Thông tin chung
              </button>
            </li>
            ) : null}
            {canAccessPricing ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("pricing")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "pricing"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <DollarSign className="size-4 shrink-0" aria-hidden />
                Giá & thanh toán
              </button>
            </li>
            ) : null}
            {canAccessContent ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("content")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "content"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <List className="size-4 shrink-0" aria-hidden />
                Nội dung & bài học
              </button>
            </li>
            ) : null}
            {canAccessAssignments ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("assignments")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "assignments"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                Bài tập cuối khoá
              </button>
            </li>
            ) : null}
            {canAccessCertificate ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("certificate")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "certificate"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Award className="size-4 shrink-0" aria-hidden />
                Chứng nhận
              </button>
            </li>
            ) : null}
            {canAccessStudents ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("students")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "students"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Users className="size-4 shrink-0" aria-hidden />
                Quản lý học viên
              </button>
            </li>
            ) : null}
            {canAccessDanger ? (
            <li className="mt-2 border-t border-border-subtle pt-2">
              <button
                type="button"
                onClick={() => setSection("danger")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                Xoá khoá học
              </button>
            </li>
            ) : null}
          </ul>
        </nav>

        {/* Nội dung theo section đang chọn */}
        <div className="min-w-0 flex-1">
          {activeSection === "info" && canAccessInfo && (
            <section className="rounded-md border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground">
                Thông tin chung
              </h2>
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel>{t("courseEdit.i18n.supportedLocalesLabel" as never)}</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["vi", "en"] as const).map((loc) => {
                      const enabled = supportedLocales.includes(loc);
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() =>
                            setSupportedLocales((prev) => {
                              const next = new Set(prev);
                              if (next.has(loc)) next.delete(loc);
                              else next.add(loc);
                              const result = Array.from(next);
                              // ensure at least 1 locale exists
                              if (result.length === 0) return prev;
                              // keep primary valid
                              if (!result.includes(primaryContentLocale)) {
                                setPrimaryContentLocale(result[0] ?? "vi");
                              }
                              // keep active valid
                              if (!result.includes(activeContentLocale)) {
                                setActiveContentLocale(result[0] ?? "vi");
                              }
                              return result;
                            })
                          }
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs font-medium",
                            enabled
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border-subtle bg-background text-muted-foreground",
                          )}
                        >
                          {loc.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("courseEdit.i18n.supportedLocalesHint" as never)}
                  </p>
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.i18n.primaryLocaleLabel" as never)}</FieldLabel>
                  <select
                    value={primaryContentLocale}
                    onChange={(e) =>
                      setPrimaryContentLocale(normalizeCourseLocale(e.target.value))
                    }
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {supportedLocales.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.i18n.editingLocaleLabel" as never)}</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {supportedLocales.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setActiveContentLocale(loc)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          activeContentLocale === loc
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border-subtle bg-background text-muted-foreground",
                        )}
                      >
                        {loc.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {activeContentLocale !== primaryContentLocale ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.i18n.editingNonPrimaryHint" as never)}
                    </p>
                  ) : null}
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!id || backfillingLocales}
                    onClick={() => {
                      if (!id) return;
                      if (!confirm(t("courseEdit.i18n.backfillConfirm" as never))) return;
                      setBackfillingLocales(true);
                      void backfillCourseLocaleIndex(id, supportedLocales)
                        .then((res) => {
                          toast.success(
                            String(
                              t("courseEdit.i18n.backfillDone" as never, {
                                defaultValue: `Đã backfill ${res.updated} tài liệu locale.`,
                                count: res.updated,
                              } as never),
                            ),
                          );
                        })
                        .catch((e) => {
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : t("courseEdit.i18n.backfillFailed" as never),
                          );
                        })
                        .finally(() => setBackfillingLocales(false));
                    }}
                  >
                    {backfillingLocales
                      ? t("courseEdit.i18n.backfilling" as never)
                      : t("courseEdit.i18n.backfillAction" as never)}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t("courseEdit.i18n.backfillHint" as never)}
                  </p>
                </div>
                <Field>
                  <FieldLabel>{t("courseEdit.form.titleLabel")}</FieldLabel>
                  <Input
                    value={contentForm.title}
                    onChange={(e) =>
                      setContentForm((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Slug</FieldLabel>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, slug: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.form.shortDescriptionLabel")}</FieldLabel>
                  <Input
                    value={contentForm.short_description}
                    onChange={(e) =>
                      setContentForm((p) => ({
                        ...p,
                        short_description: e.target.value,
                      }))
                    }
                    placeholder={t("courseEdit.form.shortDescriptionPlaceholder")}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.form.descriptionLabel")}</FieldLabel>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("courseEdit.form.descriptionMarkdownHint")}
                  </p>
                  <textarea
                    value={contentForm.description}
                    onChange={(e) =>
                      setContentForm((p) => ({ ...p, description: e.target.value }))
                    }
                    className="min-h-[140px] w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={4}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.form.learningOutcomesLabel")}</FieldLabel>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("courseEdit.form.learningOutcomesSubtitle")}
                  </p>
                  <div className="mt-3 space-y-2">
                    {(contentForm.learning_outcomes ?? []).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={item}
                          onChange={(e) =>
                            setContentForm((p) => {
                              const next = [...(p.learning_outcomes ?? [])];
                              next[idx] = e.target.value;
                              return { ...p, learning_outcomes: next };
                            })
                          }
                          placeholder={t("courseEdit.form.learningOutcomesItemPlaceholder")}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() =>
                            setContentForm((p) => {
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
                      setContentForm((p) => ({
                        ...p,
                        learning_outcomes: [...(p.learning_outcomes ?? []), ""],
                      }))
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    {t("courseEdit.form.learningOutcomesAdd")}
                  </Button>
                </Field>

                {course && canEditCoInstructors ? (
                  <Field>
                    <FieldLabel>
                      {String(
                        t("courseEdit.coInstructors.label" as never, {
                          defaultValue: "Co-instructors",
                        } as never),
                      )}
                    </FieldLabel>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(
                        t("courseEdit.coInstructors.hint" as never, {
                          defaultValue:
                            "Thêm đồng giảng viên để hiển thị trên trang khoá học và cấp một số quyền giới hạn.",
                        } as never),
                      )}
                    </p>

                    <div className="mt-3 space-y-3">
                      <ProfileCombobox
                        title={String(
                          t("courseEdit.coInstructors.dialogTitle" as never, {
                            defaultValue: "Chọn co-instructors",
                          } as never),
                        )}
                        description={String(
                          t("courseEdit.coInstructors.dialogDescription" as never, {
                            defaultValue:
                              "Chỉ những instructor có trong danh sách mới có thể được chọn.",
                          } as never),
                        )}
                        options={
                          instructorDirectory
                            .filter((p) => p.id !== course.instructor_id)
                            .map(
                              (p): ProfileComboboxOption => ({
                                id: p.id,
                                label:
                                  p.full_name ??
                                  p.email ??
                                  String(
                                    t("courseEdit.coInstructors.fallbackName" as never, {
                                      defaultValue: "Instructor",
                                    } as never),
                                  ),
                                description:
                                  p.instructor_headline ??
                                  p.instructor_organization ??
                                  null,
                              }),
                            )
                        }
                        placeholder={String(
                          t("courseEdit.coInstructors.placeholder" as never, {
                            defaultValue: "Chọn co-instructors…",
                          } as never),
                        )}
                        searchPlaceholder={String(
                          t("courseEdit.coInstructors.searchPlaceholder" as never, {
                            defaultValue: "Tìm theo tên/email…",
                          } as never),
                        )}
                        emptyLabel={String(
                          t("courseEdit.coInstructors.emptyLabel" as never, {
                            defaultValue: "Không có instructor phù hợp.",
                          } as never),
                        )}
                        multiple
                        value={coInstructorIds}
                        onChange={(value) => {
                          const ids = (Array.isArray(value) ? value : [])
                            .map((v) => String(v).trim())
                            .filter(Boolean)
                            .filter((v) => v !== course.instructor_id);
                          const unique = Array.from(new Set(ids));
                          setCoInstructorIds(unique);
                          setCoInstructorPermissions((prev) => {
                            const next = { ...prev };
                            for (const id of Object.keys(next)) {
                              if (!unique.includes(id)) delete next[id];
                            }
                            return next;
                          });
                        }}
                      />

                      {loadingInstructorDirectory ? (
                        <p className="text-xs text-muted-foreground">
                          {String(
                            t("courseEdit.coInstructors.loadingDirectory" as never, {
                              defaultValue: "Đang tải danh sách instructor…",
                            } as never),
                          )}
                        </p>
                      ) : null}

                      {coInstructorIds.length > 0 ? (
                        <div className="space-y-3">
                          {coInstructorIds.map((cid) => {
                            const display =
                              instructorDirectory.find((p) => p.id === cid)
                                ?.full_name ??
                              instructorDirectory.find((p) => p.id === cid)
                                ?.email ??
                              cid;
                            const perms = coInstructorPermissions[cid] ?? {};
                            return (
                              <div
                                key={cid}
                                className="rounded-md border border-border-subtle bg-muted/20 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground">
                                      {display}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      {cid}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => {
                                      setCoInstructorIds((prev) =>
                                        prev.filter((id) => id !== cid),
                                      );
                                      setCoInstructorPermissions((prev) => {
                                        const next = { ...prev };
                                        delete next[cid];
                                        return next;
                                      });
                                    }}
                                  >
                                    <XCircle className="size-4" aria-hidden />
                                  </Button>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {CO_INSTRUCTOR_PERMISSION_KEYS.map((item) => {
                                    const checked = perms[item.key] === true;
                                    return (
                                      <label
                                        key={item.key}
                                        className="flex items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            const nextVal = e.target.checked;
                                            setCoInstructorPermissions((prev) => ({
                                              ...prev,
                                              [cid]: {
                                                ...(prev[cid] ?? {}),
                                                [item.key]: nextVal,
                                              },
                                            }));
                                          }}
                                        />
                                        <span className="text-foreground">
                                          {String(
                                            t(item.labelKey as never, {
                                              defaultValue: item.key,
                                            } as never),
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel>{t("courseEdit.form.thumbnailLabel")}</FieldLabel>
                  <div className="mt-1 flex items-center gap-3">
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
                        ? t("courseEdit.labels.uploadingThumb")
                        : t("courseEdit.labels.uploadThumb")}
                    </Button>
                    {course.thumbnail_url && (
                      <img
                        src={course.thumbnail_url}
                        alt=""
                        className="h-12 w-20 rounded border border-border-subtle object-cover"
                      />
                    )}
                  </div>
                </Field>
                {showBusinessSettingsSection && (
                  <>
                    <Field>
                      <FieldLabel>
                        Sở hữu khoá học & chia sẻ doanh thu
                      </FieldLabel>
                      <select
                        value={form.owner_type}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            owner_type: e.target.value as CourseOwnerType,
                          }))
                        }
                        disabled={!canManageBusinessSettings}
                        className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
                        <p className="mt-1 text-xs text-muted-foreground">
                          Chỉ học vụ/admin được cập nhật phần sở hữu và doanh
                          thu.
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Hiện tại: {getCourseOwnerTypeLabel(form.owner_type)}.
                      </p>
                    </Field>
                    {form.owner_type === "external_partner" && (
                      <>
                        <Field>
                          <FieldLabel>{t("courseEdit.form.platformRevenueShareLabel")}</FieldLabel>
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
                            Giảng viên nhận{" "}
                            {100 -
                              Number(form.platform_revenue_share_percent || 0)}
                            %.
                          </p>
                        </Field>
                        <Field>
                          <FieldLabel>
                            Thông tin chuyển khoản đối tác
                          </FieldLabel>
                          <textarea
                            value={form.partner_transfer_info}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                partner_transfer_info: e.target.value,
                              }))
                            }
                            disabled={!canManageBusinessSettings}
                            rows={4}
                            className="min-h-[90px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                            placeholder={t("courseEdit.form.partnerTransferPlaceholder")}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Hiển thị cho giảng viên đối tác trong mục Hoá đơn &
                            thanh toán.
                          </p>
                        </Field>
                        <Field>
                          <FieldLabel>{t("courseEdit.form.partnerContractDocsLabel")}</FieldLabel>
                          <Input
                            type="file"
                            disabled={
                              !canManageBusinessSettings || uploadingContractDoc
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                void handleUploadPartnerDocument(
                                  "contract",
                                  file,
                                );
                              e.target.value = "";
                            }}
                          />
                          {form.partner_contract_docs.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs">
                              {form.partner_contract_docs.map((doc) => (
                                <a
                                  key={doc.path}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-primary hover:underline"
                                >
                                  {doc.name}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Chưa có tài liệu hợp đồng.
                            </p>
                          )}
                        </Field>
                        <Field>
                          <FieldLabel>{t("courseEdit.form.partnerInvoiceDocsLabel")}</FieldLabel>
                          <Input
                            type="file"
                            disabled={
                              !canManageBusinessSettings || uploadingInvoiceDoc
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                void handleUploadPartnerDocument(
                                  "invoice",
                                  file,
                                );
                              e.target.value = "";
                            }}
                          />
                          {form.partner_invoice_docs.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs">
                              {form.partner_invoice_docs.map((doc) => (
                                <a
                                  key={doc.path}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-primary hover:underline"
                                >
                                  {doc.name}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Chưa có tài liệu hoá đơn.
                            </p>
                          )}
                        </Field>
                      </>
                    )}
                  </>
                )}
                <Field>
                  <FieldLabel>{t("courseEdit.form.levelLabel")}</FieldLabel>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        level: e.target.value as CourseLevel,
                      }))
                    }
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        setForm((p) => ({ ...p, published: e.target.checked }))
                      }
                      className="rounded border-input"
                    />
                    <span className="text-sm font-medium">
                      {t("courseEdit.publishing.publishedHint")}
                    </span>
                  </label>
                </Field>
                <Field>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_updating}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          is_updating: e.target.checked,
                        }))
                      }
                      className="rounded border-input"
                    />
                    <span className="text-sm font-medium">
                      {t("courseEdit.publishing.updatingHint")}
                    </span>
                  </label>
                </Field>
              </FieldGroup>
              <Button
                className="mt-4"
                onClick={() => void saveCourseInfo(t("courseEdit.labels.saveInfo"))}
                disabled={saving}
              >
                {saving ? t("courseEdit.labels.saving") : t("courseEdit.labels.save")}
              </Button>
            </section>
          )}

          {activeSection === "pricing" && canAccessPricing && (
            <section className="rounded-md border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                <DollarSign className="size-5" aria-hidden /> Giá & thanh toán
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Thiết lập mô hình truy cập, giá khoá học, phí chứng nhận và mã
                giảm giá.
              </p>

              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel>{t("courseEdit.pricing.accessModelLabel")}</FieldLabel>
                  <select
                    value={form.access_model}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        access_model: e.target.value as CourseAccessModel,
                      }))
                    }
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <>
                    <Field>
                      <FieldLabel>{t("courseEdit.pricing.priceVndLabel")}</FieldLabel>
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
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Học viên chưa thanh toán chỉ xem được bài có bật "Học
                        thử miễn phí".
                      </p>
                    </Field>

                    <Field>
                      <FieldLabel>{t("courseEdit.pricing.promoPriceVndLabel")}</FieldLabel>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatVndInput(form.promo_price_vnd)}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            promo_price_vnd: normalizeVndDigits(e.target.value),
                          }))
                        }
                        placeholder={t("courseEdit.pricing.promoPricePlaceholder")}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Giá khuyến mãi phải nhỏ hơn giá gốc.
                      </p>
                    </Field>

                    <Field>
                      <FieldLabel>{t("courseEdit.pricing.promoEndsAtLabel")}</FieldLabel>
                      <Input
                        value={form.promo_ends_at}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            promo_ends_at: e.target.value,
                          }))
                        }
                        placeholder="2026-03-31T23:59:59.000Z"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Để trống nếu không hẹn giờ.
                      </p>
                    </Field>

                    <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Mã giảm giá & khuyến mãi
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("courseEdit.discounts.createTitle")}
                            thời gian/lượt dùng.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!id || loadingDiscounts}
                          onClick={() => {
                            if (!id) return;
                            setLoadingDiscounts(true);
                            listCourseDiscounts(id)
                              .then((rows) => setDiscounts(rows))
                              .finally(() => setLoadingDiscounts(false));
                          }}
                        >
                          {loadingDiscounts
                            ? t("courseEdit.labels.loading")
                            : t("courseEdit.labels.reload")}
                        </Button>
                      </div>

                      {discounts.length === 0 ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Chưa có mã giảm giá nào.
                        </p>
                      ) : (
                        <div className="mt-3 overflow-hidden rounded-md border border-border-subtle bg-background">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-border-subtle bg-muted/40">
                                <th className="px-3 py-2 font-medium text-foreground">
                                  Code
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  Loại
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  Giá trị
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  Trạng thái
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  Hành động
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {discounts.map((d) => (
                                <tr
                                  key={d.id}
                                  className="border-b border-border-subtle last:border-b-0"
                                >
                                  <td className="px-3 py-2 font-mono text-foreground">
                                    {d.code}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {d.type === "percent" ? "%" : "VND"}
                                  </td>
                                  <td className="px-3 py-2 text-foreground">
                                    {d.type === "percent"
                                      ? `${d.value}%`
                                      : formatVndPrice(d.value)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {d.active ? (
                                      <span className="text-success text-xs">
                                        Active
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">
                                        Off
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          if (!id) return;
                                          await setCourseDiscountActive(
                                            id,
                                            d.id,
                                            !d.active,
                                          );
                                          setDiscounts((prev) =>
                                            prev.map((x) =>
                                              x.id === d.id
                                                ? { ...x, active: !d.active }
                                                : x,
                                            ),
                                          );
                                        }}
                                      >
                                        {d.active
                                          ? t("courseEdit.discounts.activeOff")
                                          : t("courseEdit.discounts.activeOn")}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                        onClick={async () => {
                                          if (!id) return;
                                          await deleteCourseDiscountCode(
                                            id,
                                            d.id,
                                          );
                                          setDiscounts((prev) =>
                                            prev.filter((x) => x.id !== d.id),
                                          );
                                        }}
                                      >
                                        Xoá
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Code
                          </label>
                          <Input
                            value={discountForm.code}
                            onChange={(e) =>
                              setDiscountForm((p) => ({
                                ...p,
                                code: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="VD: SPRING10"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Loại
                            </label>
                            <select
                              value={discountForm.type}
                              onChange={(e) =>
                                setDiscountForm((p) => ({
                                  ...p,
                                  type: e.target.value as CourseDiscountType,
                                }))
                              }
                              className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="percent">%</option>
                              <option value="amount_vnd">VND</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Giá trị
                            </label>
                            <Input
                              inputMode="numeric"
                              value={discountForm.value}
                              onChange={(e) =>
                                setDiscountForm((p) => ({
                                  ...p,
                                  value: normalizeVndDigits(e.target.value),
                                }))
                              }
                              placeholder={
                                discountForm.type === "percent" ? "10" : "50000"
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Bắt đầu (ISO, tuỳ chọn)
                          </label>
                          <Input
                            value={discountForm.starts_at}
                            onChange={(e) =>
                              setDiscountForm((p) => ({
                                ...p,
                                starts_at: e.target.value,
                              }))
                            }
                            placeholder="2026-03-17T00:00:00.000Z"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Kết thúc (ISO, tuỳ chọn)
                          </label>
                          <Input
                            value={discountForm.ends_at}
                            onChange={(e) =>
                              setDiscountForm((p) => ({
                                ...p,
                                ends_at: e.target.value,
                              }))
                            }
                            placeholder="2026-03-31T23:59:59.000Z"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Giới hạn lượt dùng (tuỳ chọn)
                          </label>
                          <Input
                            inputMode="numeric"
                            value={discountForm.max_redemptions}
                            onChange={(e) =>
                              setDiscountForm((p) => ({
                                ...p,
                                max_redemptions: normalizeVndDigits(
                                  e.target.value,
                                ),
                              }))
                            }
                            placeholder="100"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            disabled={
                              creatingDiscount ||
                              !id ||
                              !discountForm.code.trim() ||
                              Number(discountForm.value || 0) <= 0
                            }
                            onClick={async () => {
                              if (!id) return;
                              setCreatingDiscount(true);
                              try {
                                const created = await createCourseDiscount(id, {
                                  code: discountForm.code,
                                  type: discountForm.type,
                                  value: Number(discountForm.value || 0),
                                  starts_at:
                                    discountForm.starts_at.trim() || null,
                                  ends_at: discountForm.ends_at.trim() || null,
                                  max_redemptions: discountForm.max_redemptions
                                    ? Number(discountForm.max_redemptions)
                                    : null,
                                  active: true,
                                });
                                setDiscounts((prev) => [created, ...prev]);
                                setDiscountForm({
                                  code: "",
                                  type: "percent",
                                  value: "",
                                  starts_at: "",
                                  ends_at: "",
                                  max_redemptions: "",
                                });
                                toast.success(t("courseEdit.toasts.discountCreated"));
                              } catch (e) {
                                toast.error(
                                  e instanceof Error
                                    ? e.message
                                    : t("courseEdit.errors.createDiscountFailed"),
                                );
                              } finally {
                                setCreatingDiscount(false);
                              }
                            }}
                          >
                            {creatingDiscount
                              ? t("courseEdit.labels.creatingDiscount")
                              : t("courseEdit.labels.createDiscount")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {form.access_model === "free_with_paid_certificate" && (
                  <Field>
                    <FieldLabel>
                      Phí chứng nhận / bài thu hoạch (VND)
                    </FieldLabel>
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
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Toàn bộ bài học vẫn miễn phí; khoản phí này áp dụng khi
                      học viên muốn nộp bài thu hoạch để xét chứng nhận.
                    </p>
                  </Field>
                )}
              </FieldGroup>

              <Button
                className="mt-4"
                onClick={() =>
                  void saveCourseInfo(t("courseEdit.labels.savePricing"))
                }
                disabled={saving || !canEdit}
              >
                {saving ? t("courseEdit.labels.saving") : t("courseEdit.labels.save")}
              </Button>
            </section>
          )}

          {activeSection === "content" && canAccessContent && (
            <section className="rounded-md border border-border-subtle bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <List className="size-5" /> Nội dung khoá học
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {reorderingLessons && (
                    <span className="text-xs text-muted-foreground">
                      Đang lưu thứ tự bài học...
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshingTotal || lessons.length === 0 || !canEdit}
                    onClick={() => void handleRefreshTotalDuration()}
                  >
                    {refreshingTotal
                      ? t("courseEdit.labels.updating")
                      : t("courseEdit.labels.updateTotalDuration")}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Kéo biểu tượng chấm để đổi thứ tự bài trong từng chương, hoặc
                dùng mũi tên lên/xuống khi cần.
              </p>

              <div className="mt-4 space-y-4">
                {form.access_model === "paid_upfront" && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                    {t("courseEdit.pricing.updateTotalDurationLabelPrefix")}
                    muốn mở cho học viên chưa thanh toán.
                  </div>
                )}
                {lessonsBySection.map(({ section, lessons: secLessons }) => (
                  <div
                    key={section.id}
                    className="overflow-hidden rounded-md border border-border-subtle bg-card"
                  >
                    <div className="flex items-center justify-between border-b border-border-subtle bg-muted/40 px-4 py-2">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">
                          {section.title}
                        </span>
                        {section.description?.trim() ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {section.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSection(section)}
                        >
                          {t("courseEdit.sections.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSection(section.id)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <ul className="divide-y divide-border-subtle">
                      {secLessons.map((lesson, lessonIndex) => {
                        const isDragging = draggingLessonId === lesson.id;
                        const isDropBefore =
                          lessonDropTarget?.sectionId === section.id &&
                          lessonDropTarget.lessonId === lesson.id &&
                          lessonDropTarget.position === "before";
                        const isDropAfter =
                          lessonDropTarget?.sectionId === section.id &&
                          lessonDropTarget.lessonId === lesson.id &&
                          lessonDropTarget.position === "after";

                        return (
                          <li
                            key={lesson.id}
                            onDragOver={(event) =>
                              handleLessonDragOver(section.id, lesson.id, event)
                            }
                            onDrop={(event) =>
                              void handleLessonDrop(section.id, lesson.id, event)
                            }
                            onDragEnd={clearLessonDragState}
                            className={cn(
                              "flex flex-col gap-2 px-4 py-2 transition-[background-color,border-color,opacity] md:flex-row md:items-center md:justify-between",
                              isDragging && "opacity-45",
                              isDropBefore && "border-t-2 border-primary bg-primary/5",
                              isDropAfter && "border-b-2 border-primary bg-primary/5",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                              <button
                                type="button"
                                draggable={!reorderingLessons}
                                disabled={reorderingLessons}
                                onDragStart={(event) =>
                                  handleLessonDragStart(
                                    section.id,
                                    lesson.id,
                                    event,
                                  )
                                }
                                onDragEnd={clearLessonDragState}
                                aria-label={`Kéo để đổi thứ tự bài ${lesson.title}`}
                                title={t("courseEdit.tooltips.dragReorder")}
                                className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:border-border-subtle hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <GripVertical className="size-4" aria-hidden />
                              </button>
                              <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                              <span className="text-sm text-foreground truncate">
                                {lesson.title}
                              </span>
                              {form.access_model === "paid_upfront" &&
                                lesson.is_preview_free && (
                                  <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                    Học thử
                                  </span>
                                )}
                              {!lesson.youtube_url?.trim() ? (
                                <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                                  {t("courseEdit.lessons.draftBadge")}
                                </span>
                              ) : null}
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDuration(lesson.duration_seconds)}
                              </span>
                              </div>
                              {lesson.short_description?.trim() ? (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {lesson.short_description}
                                </p>
                              ) : null}

                              {expandedLessonIds.has(lesson.id) ? (
                                <div className="mt-3 rounded-md border border-border-subtle bg-muted/20 p-3">
                                  {lesson.description_markdown?.trim() ? (
                                    <Markdown content={lesson.description_markdown} />
                                  ) : null}
                                  {lesson.resources?.length ? (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        {t("courseEdit.lessons.resourcesLabel")}
                                      </p>
                                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                        {lesson.resources
                                          .map((r) => ({
                                            title: (r.title ?? "").trim(),
                                            url: (r.url ?? "").trim(),
                                          }))
                                          .filter((r) => r.title && r.url)
                                          .map((r) => (
                                            <li key={r.url} className="truncate">
                                              <a
                                                href={r.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline underline-offset-4"
                                              >
                                                {r.title}
                                              </a>
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                              {(lesson.description_markdown?.trim() ||
                                lesson.resources?.length) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setExpandedLessonIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(lesson.id)) next.delete(lesson.id);
                                      else next.add(lesson.id);
                                      return next;
                                    })
                                  }
                                >
                                  {expandedLessonIds.has(lesson.id)
                                    ? t("courseEdit.lessons.hidePreview")
                                    : t("courseEdit.lessons.showPreview")}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditLesson(lesson)}
                              >
                                {t("courseEdit.lessons.edit")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={reorderingLessons || lessonIndex === 0}
                                onClick={() =>
                                  void handleMoveLesson(section.id, lesson.id, -1)
                                }
                                aria-label={`Đưa bài ${lesson.title} lên trên`}
                                title={t("courseEdit.tooltips.moveUp")}
                              >
                                <ArrowUpFromLine className="size-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={
                                  reorderingLessons ||
                                  lessonIndex === secLessons.length - 1
                                }
                                onClick={() =>
                                  void handleMoveLesson(section.id, lesson.id, 1)
                                }
                                aria-label={`Đưa bài ${lesson.title} xuống dưới`}
                                title={t("courseEdit.tooltips.moveDown")}
                              >
                                <ArrowDownToLine className="size-4" aria-hidden />
                              </Button>
                              {form.access_model === "paid_upfront" && (
                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={!!lesson.is_preview_free}
                                    disabled={reorderingLessons}
                                    onChange={(e) =>
                                      void handleTogglePreviewLesson(
                                        lesson.id,
                                        e.target.checked,
                                      )
                                    }
                                    className="rounded border-input"
                                  />
                                  Học thử miễn phí
                                </label>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive shrink-0"
                                disabled={reorderingLessons}
                                onClick={() => handleDeleteLesson(lesson.id)}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="border-t border-border-subtle p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAddingLessonDraftSectionId(section.id);
                          setNewLessonTitle("");
                          setNewLessonShortDescription("");
                          setNewLessonYoutubeUrl("");
                          setNewLessonMinutes("");
                          setNewLessonIsPreviewFree(false);
                          setNewLessonMarkdown("");
                          setNewLessonResources([]);
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <Plus className="size-4" /> {t("courseEdit.lessons.create")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-md border border-dashed border-border-subtle p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Thêm chương mới
                </p>
                <div className="grid gap-2">
                  <Input
                    placeholder={t("courseEdit.content.sectionTitlePlaceholder")}
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                  />
                  <textarea
                    value={newSectionDescription}
                    onChange={(e) => setNewSectionDescription(e.target.value)}
                    placeholder={t("courseEdit.sections.descriptionPlaceholder")}
                    className="min-h-[72px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={3}
                  />
                  <Button
                    onClick={() => void handleAddSection()}
                    disabled={addingSection || !newSectionTitle.trim()}
                  >
                    {addingSection
                      ? t("courseEdit.labels.addingSection")
                      : t("courseEdit.labels.addSection")}
                  </Button>
                </div>
              </div>
            </section>
          )}

          <Dialog open={!!editingSection} onOpenChange={(open) => !open && setEditingSection(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("courseEdit.sections.editTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Field>
                  <FieldLabel>{t("courseEdit.sections.titleLabel")}</FieldLabel>
                  <Input
                    value={editingSectionTitle}
                    onChange={(e) => setEditingSectionTitle(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.sections.descriptionLabel")}</FieldLabel>
                  <textarea
                    value={editingSectionDescription}
                    onChange={(e) => setEditingSectionDescription(e.target.value)}
                    placeholder={t("courseEdit.sections.descriptionPlaceholder")}
                    className="min-h-[100px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={4}
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingSection(null)}>
                  {t("courseEdit.sections.cancel")}
                </Button>
                <Button type="button" onClick={() => void handleSaveSectionDetails()}>
                  {t("courseEdit.sections.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingLesson} onOpenChange={(open) => !open && setEditingLesson(null)}>
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-0">
              <div className="flex max-h-[85vh] flex-col">
                <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-background/95 p-4 backdrop-blur">
                  <DialogTitle>{t("courseEdit.lessons.editTitle")}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4 md:pr-2">
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.youtubeLabel")}</FieldLabel>
                    <Input
                      value={editingLessonYoutubeUrl}
                      onChange={(e) => setEditingLessonYoutubeUrl(e.target.value)}
                      placeholder={t("courseEdit.lessons.youtubePlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.titleLabel")}</FieldLabel>
                    <Input
                      value={editingLessonTitle}
                      onChange={(e) => setEditingLessonTitle(e.target.value)}
                      placeholder={t("courseEdit.content.lessonTitlePlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.videoPrimaryLocaleLabel" as never)}</FieldLabel>
                    <select
                      value={editingLessonVideoPrimaryLocale}
                      onChange={(e) =>
                        setEditingLessonVideoPrimaryLocale(
                          normalizeCourseLocale(e.target.value),
                        )
                      }
                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {(["vi", "en"] as const).map((loc) => (
                        <option key={loc} value={loc}>
                          {loc.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.lessons.videoPrimaryLocaleHint" as never)}
                    </p>
                  </Field>
                  <Field>
                    <label className="inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={editingLessonHasSubtitle}
                        onChange={(e) => setEditingLessonHasSubtitle(e.target.checked)}
                        className="rounded border-input"
                      />
                      <span>{t("courseEdit.lessons.hasSubtitleLabel" as never)}</span>
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.lessons.subtitleHint" as never)}
                    </p>
                    {editingLessonHasSubtitle ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["vi", "en"] as const).map((loc) => {
                          const active = editingLessonSubtitleLocales.includes(loc);
                          return (
                            <button
                              key={loc}
                              type="button"
                              onClick={() =>
                                setEditingLessonSubtitleLocales((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(loc)) next.delete(loc);
                                  else next.add(loc);
                                  return Array.from(next);
                                })
                              }
                              className={cn(
                                "rounded-md border px-2 py-1 text-xs font-medium",
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border-subtle bg-background text-muted-foreground",
                              )}
                            >
                              {loc.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.shortDescriptionLabel")}</FieldLabel>
                    <Input
                      value={editingLessonShortDescription}
                      onChange={(e) => setEditingLessonShortDescription(e.target.value)}
                      placeholder={t("courseEdit.lessons.shortDescriptionPlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.markdownLabel")}</FieldLabel>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.lessons.markdownHint")}
                    </p>
                    <textarea
                      value={editingLessonMarkdown}
                      onChange={(e) => setEditingLessonMarkdown(e.target.value)}
                      className="min-h-[220px] w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={10}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.resourcesLabel")}</FieldLabel>
                    <div className="mt-2 space-y-2">
                      {editingLessonResources.map((r, idx) => (
                        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto] sm:items-center">
                          <Input
                            value={r.title}
                            placeholder={t("courseEdit.lessons.resourceTitlePlaceholder")}
                            onChange={(e) =>
                              setEditingLessonResources((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], title: e.target.value };
                                return next;
                              })
                            }
                          />
                          <Input
                            value={r.url}
                            placeholder={t("courseEdit.lessons.resourceUrlPlaceholder")}
                            onChange={(e) =>
                              setEditingLessonResources((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], url: e.target.value };
                                return next;
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() =>
                              setEditingLessonResources((prev) => {
                                const next = [...prev];
                                next.splice(idx, 1);
                                return next;
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
                        setEditingLessonResources((prev) => [...prev, { title: "", url: "" }])
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      {t("courseEdit.lessons.addResource")}
                    </Button>
                  </Field>
                </div>
                <div className="space-y-4 md:sticky md:top-4 md:self-start">
                  <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("courseEdit.lessons.previewTitle")}
                    </p>
                    {editingLessonShortDescription.trim() ? (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {editingLessonShortDescription.trim()}
                      </p>
                    ) : null}
                    {editingLessonMarkdown.trim() ? (
                      <div className="mt-3">
                        <Markdown content={editingLessonMarkdown} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t("courseEdit.lessons.previewEmpty")}
                      </p>
                    )}
                    {editingLessonResources
                      .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
                      .filter((r) => r.title && r.url).length ? (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-foreground">
                          {t("courseEdit.lessons.resourcesLabel")}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {editingLessonResources
                            .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
                            .filter((r) => r.title && r.url)
                            .map((r, idx) => (
                              <li key={`${idx}-${r.url}`} className="truncate">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline underline-offset-4"
                                >
                                  {r.title}
                                </a>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 z-10 border-t border-border-subtle bg-background/95 p-4 backdrop-blur">
                  <Button type="button" variant="outline" onClick={() => setEditingLesson(null)}>
                    {t("courseEdit.lessons.cancel")}
                  </Button>
                  <Button type="button" onClick={() => void handleSaveLessonDetails()}>
                    {t("courseEdit.lessons.save")}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={addingLessonDraftSectionId != null}
            onOpenChange={(open) => !open && setAddingLessonDraftSectionId(null)}
          >
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-0">
              <div className="flex max-h-[85vh] flex-col">
                <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-background/95 p-4 backdrop-blur">
                  <DialogTitle>{t("courseEdit.lessons.createTitle")}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4 md:pr-2">
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.youtubeLabel")}</FieldLabel>
                    <Input
                      value={newLessonYoutubeUrl}
                      onChange={(e) => setNewLessonYoutubeUrl(e.target.value)}
                      placeholder={t("courseEdit.lessons.youtubePlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.videoPrimaryLocaleLabel" as never)}</FieldLabel>
                    <select
                      value={defaultVideoPrimaryLocale}
                      onChange={(e) =>
                        setDefaultVideoPrimaryLocale(normalizeCourseLocale(e.target.value))
                      }
                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {(["vi", "en"] as const).map((loc) => (
                        <option key={loc} value={loc}>
                          {loc.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.lessons.videoPrimaryLocaleHint" as never)}
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.titleLabel")}</FieldLabel>
                    <Input
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      placeholder={t("courseEdit.content.lessonTitlePlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.shortDescriptionLabel")}</FieldLabel>
                    <Input
                      value={newLessonShortDescription}
                      onChange={(e) => setNewLessonShortDescription(e.target.value)}
                      placeholder={t("courseEdit.lessons.shortDescriptionPlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.durationMinutesLabel")}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={newLessonMinutes === "" ? "" : String(newLessonMinutes)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewLessonMinutes(
                          v === "" ? "" : Math.max(0, parseInt(v, 10) || 0),
                        );
                      }}
                      placeholder={t("courseEdit.content.lessonMinutesPlaceholder")}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.lessons.durationHint")}
                    </p>
                  </Field>
                  {form.access_model === "paid_upfront" && (
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newLessonIsPreviewFree}
                        onChange={(e) => setNewLessonIsPreviewFree(e.target.checked)}
                        className="rounded border-input"
                      />
                      {t("courseEdit.lessons.previewFreeLabel")}
                    </label>
                  )}
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.markdownLabel")}</FieldLabel>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("courseEdit.lessons.markdownHint")}
                    </p>
                    <textarea
                      value={newLessonMarkdown}
                      onChange={(e) => setNewLessonMarkdown(e.target.value)}
                      className="min-h-[220px] w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={10}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.resourcesLabel")}</FieldLabel>
                    <div className="mt-2 space-y-2">
                      {newLessonResources.map((r, idx) => (
                        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto] sm:items-center">
                          <Input
                            value={r.title}
                            placeholder={t("courseEdit.lessons.resourceTitlePlaceholder")}
                            onChange={(e) =>
                              setNewLessonResources((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], title: e.target.value };
                                return next;
                              })
                            }
                          />
                          <Input
                            value={r.url}
                            placeholder={t("courseEdit.lessons.resourceUrlPlaceholder")}
                            onChange={(e) =>
                              setNewLessonResources((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], url: e.target.value };
                                return next;
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() =>
                              setNewLessonResources((prev) => {
                                const next = [...prev];
                                next.splice(idx, 1);
                                return next;
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
                        setNewLessonResources((prev) => [...prev, { title: "", url: "" }])
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      {t("courseEdit.lessons.addResource")}
                    </Button>
                  </Field>
                </div>
                <div className="space-y-4 md:sticky md:top-4 md:self-start">
                  <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("courseEdit.lessons.previewTitle")}
                    </p>
                    {newLessonShortDescription.trim() ? (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {newLessonShortDescription.trim()}
                      </p>
                    ) : null}
                    {newLessonMarkdown.trim() ? (
                      <div className="mt-3">
                        <Markdown content={newLessonMarkdown} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t("courseEdit.lessons.previewEmpty")}
                      </p>
                    )}
                    {newLessonResources
                      .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
                      .filter((r) => r.title && r.url).length ? (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-foreground">
                          {t("courseEdit.lessons.resourcesLabel")}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {newLessonResources
                            .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
                            .filter((r) => r.title && r.url)
                            .map((r, idx) => (
                              <li key={`${idx}-${r.url}`} className="truncate">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline underline-offset-4"
                                >
                                  {r.title}
                                </a>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 z-10 border-t border-border-subtle bg-background/95 p-4 backdrop-blur">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingLessonDraftSectionId(null)}
                  >
                    {t("courseEdit.lessons.cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={addingLessonInProgress || !addingLessonDraftSectionId}
                    onClick={() => addingLessonDraftSectionId && handleAddLesson(addingLessonDraftSectionId)}
                  >
                    {addingLessonInProgress
                      ? t("courseEdit.lessons.creating")
                      : t("courseEdit.lessons.createAction")}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {activeSection === "assignments" && canAccessAssignments && (
            <section className="rounded-md border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-2">
                <FileText className="size-5" /> Bài tập cuối khoá
              </h2>
              {form.access_model === "free_with_paid_certificate" && (
                <p className="mb-3 text-sm text-primary">
                  Học viên cần thanh toán{" "}
                  {formatVndPrice(Number(form.certificate_fee_vnd || 0))} để mở
                  quyền nộp bài thu hoạch và xét chứng nhận (cổng thanh toán sẽ
                  tích hợp sau).
                </p>
              )}
              <p className="mb-4 text-sm text-muted-foreground">
                Nếu có, học viên phải nộp và được duyệt mới đủ điều kiện nhận
                chứng nhận.
              </p>

              <div className="mb-8 rounded-md border border-border-subtle bg-muted/20 p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Cấu hình bài tập
                </h3>
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("courseEdit.assignments.titleLabel")}</FieldLabel>
                    <Input
                      placeholder={t("courseEdit.assignments.titlePlaceholder")}
                    value={contentForm.final_assignment_title}
                      onChange={(e) =>
                      setContentForm((p) => ({
                          ...p,
                          final_assignment_title: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.assignments.descriptionLabel")}</FieldLabel>
                    <textarea
                      placeholder={t("courseEdit.assignments.descriptionPlaceholder")}
                    value={contentForm.final_assignment_description}
                      onChange={(e) =>
                      setContentForm((p) => ({
                          ...p,
                          final_assignment_description: e.target.value,
                        }))
                      }
                      className="min-h-[80px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={3}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("courseEdit.assignments.instructionsLabel")}</FieldLabel>
                    <textarea
                      placeholder={t("courseEdit.assignments.instructionsPlaceholder")}
                    value={contentForm.final_assignment_instructions}
                      onChange={(e) =>
                      setContentForm((p) => ({
                          ...p,
                          final_assignment_instructions: e.target.value,
                        }))
                      }
                      className="min-h-[60px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2}
                    />
                  </Field>
                  <Button
                    onClick={() =>
                      void saveCourseInfo(t("courseEdit.labels.saveAssignment"))
                    }
                    disabled={saving || !canEdit}
                  >
                    {saving ? t("courseEdit.labels.saving") : t("courseEdit.labels.saveAssignment")}
                  </Button>
                </FieldGroup>
              </div>

              <h3 className="text-sm font-medium text-foreground mb-3">
                Bài nộp của học viên
              </h3>
              {(contentForm.final_assignment_title || course.final_assignment_title) ? (
                <>
                  {submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Chưa có bài nộp nào.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border-subtle">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border-subtle bg-muted/40">
                            <th className="px-4 py-3 font-medium text-foreground">
                              Học viên
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground">
                              Nội dung
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground">
                              Ngày nộp
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground">
                              Trạng thái
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground w-40">
                              Thao tác
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((sub) => {
                            const profile = studentProfiles[sub.user_id];
                            const prog = studentProgress[sub.user_id] ?? 0;
                            return (
                              <tr
                                key={sub.id}
                                className="border-b border-border-subtle last:border-b-0 hover:bg-muted/30"
                              >
                                <td className="px-4 py-3">
                                  <div>
                                    <span className="font-medium text-foreground">
                                      {profile?.full_name || "—"}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {prog}% bài học
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 max-w-[200px]">
                                  <p className="line-clamp-2 text-muted-foreground">
                                    {sub.content || "—"}
                                  </p>
                                  {sub.file_urls?.length ? (
                                    <span className="text-xs text-muted-foreground">
                                      {sub.file_urls.length} file đính kèm
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {new Date(
                                    sub.submitted_at,
                                  ).toLocaleDateString(intlLocale())}
                                </td>
                                <td className="px-4 py-3">
                                  {sub.status === "approved" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                      <CheckCircle2 className="size-3.5" aria-hidden /> Đã
                                      duyệt
                                    </span>
                                  ) : sub.status === "rejected" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                                      <XCircle className="size-3.5" /> Từ chối
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                                      Chờ duyệt
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {sub.status === "pending" ? (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-success/30 text-success"
                                        disabled={
                                          reviewingSubmissionId === sub.id
                                        }
                                        onClick={() =>
                                          handleReviewSubmission(
                                            sub.id,
                                            "approved",
                                          )
                                        }
                                      >
                                        {reviewingSubmissionId === sub.id
                                          ? "..."
                                          : t("courseEdit.assignments.reviewApprove")}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-destructive/30 text-destructive"
                                        disabled={
                                          reviewingSubmissionId === sub.id
                                        }
                                        onClick={() =>
                                          handleReviewSubmission(
                                            sub.id,
                                            "rejected",
                                          )
                                        }
                                      >
                                        Từ chối
                                      </Button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có bài nộp nào. Thêm tiêu đề bài tập ở mục "Cấu hình bài
                  tập" phía trên và lưu để bật yêu cầu nộp bài.
                </p>
              )}
            </section>
          )}

          {activeSection === "certificate" && canAccessCertificate && (
            <section className="rounded-md border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-4">
                <Award className="size-5" aria-hidden /> Template
                chứng nhận
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Tải lên ảnh template chứng nhận (PNG/JPG). Tên học viên sẽ được
                hiển thị tại vị trí bạn chọn (theo % từ trái và từ trên).
              </p>

              <div className="mb-8 space-y-4">
                <Field>
                  <FieldLabel>{t("courseEdit.certificate.templateLabel")}</FieldLabel>
                  <input
                    ref={certificateInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleCertificateTemplateChange}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingCert}
                      onClick={() => certificateInputRef.current?.click()}
                    >
                      {uploadingCert
                        ? t("courseEdit.certificate.uploadingTemplate")
                        : t("courseEdit.certificate.uploadTemplate")}
                    </Button>
                    {course.certificate_template_url && (
                      <a
                        href={course.certificate_template_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Xem template hiện tại
                      </a>
                    )}
                  </div>
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.certificate.nameXLabel")}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.certificate_name_x_percent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v))
                        setForm((p) => ({
                          ...p,
                          certificate_name_x_percent: Math.max(
                            0,
                            Math.min(100, v),
                          ),
                        }));
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.certificate.nameYLabel")}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.certificate_name_y_percent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v))
                        setForm((p) => ({
                          ...p,
                          certificate_name_y_percent: Math.max(
                            0,
                            Math.min(100, v),
                          ),
                        }));
                    }}
                  />
                </Field>
                <Button
                  onClick={() =>
                    void saveCourseInfo(t("courseEdit.labels.saveCertificate"))
                  }
                  disabled={saving || !canEdit}
                >
                  {saving ? t("courseEdit.labels.saving") : t("courseEdit.certificate.saveNamePosition")}
                </Button>
              </div>

              <div className="rounded-md border border-border-subtle bg-muted/20 p-4">
                <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <FileText className="size-4" /> Hướng dẫn tạo template
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    Kích thước khuyến nghị: 1200×800 px (tỉ lệ 3:2) hoặc A4.
                  </li>
                  <li>
                    Để trống một vùng trên ảnh cho tên học viên (ví dụ giữa
                    trang).
                  </li>
                  <li>
                    {t("courseEdit.certificate.afterUploadHintPrefix")}
                    trên ) để tên học viên nằm đúng vùng trống. 50% = giữa.
                  </li>
                  <li>{t("courseEdit.certificate.fileFormatHint")}</li>
                </ul>
                <div className="mt-4">
                  <a
                    href="/certificate-template-sample.svg"
                    download="certificate-template-sample.svg"
                    className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Download className="size-4" aria-hidden /> Tải template mẫu (SVG)
                  </a>
                </div>
              </div>
            </section>
          )}

          {activeSection === "students" && canAccessStudents && (
            <section className="rounded-md border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-4">
                <Users className="size-5" /> Quản lý học viên
              </h2>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Chưa có học viên nào ghi danh vào khoá học này.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border-subtle">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-muted/40">
                        <th className="px-4 py-3 font-medium text-foreground">
                          Học viên
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Email
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Tiến độ
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Bài tập
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Chứng nhận
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Thanh toán
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Ngày ghi danh
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Lần truy cập cuối
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e) => {
                        const profile = studentProfiles[e.user_id];
                        const prog = studentProgress[e.user_id] ?? 0;
                        const sub = submissionByUser[e.user_id];
                        const hasCert = !!e.certificate_issued_at;
                        const isPaid =
                          !!e.paid_amount_vnd && e.paid_amount_vnd > 0;
                        return (
                          <tr
                            key={e.id}
                            className="border-b border-border-subtle last:border-b-0 hover:bg-muted/30"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {profile?.avatar_url ? (
                                  <img
                                    src={profile.avatar_url}
                                    alt=""
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                                    {(profile?.full_name || e.user_id)
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium text-foreground">
                                  {profile?.full_name || "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {profile?.email || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="tabular-nums">{prog}%</span>
                            </td>
                            <td className="px-4 py-3">
                              {course.final_assignment_title ? (
                                sub ? (
                                  sub.status === "approved" ? (
                                    <span className="text-success text-xs">
                                      Đã duyệt
                                    </span>
                                  ) : sub.status === "rejected" ? (
                                    <span className="text-destructive text-xs">
                                      Từ chối
                                    </span>
                                  ) : (
                                    <span className="text-warning text-xs">
                                      Chờ duyệt
                                    </span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    Chưa nộp
                                  </span>
                                )
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {hasCert ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                  <CheckCircle2 className="size-3.5" aria-hidden /> Đã cấp
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  Chưa đủ điều kiện
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isPaid ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs font-medium text-foreground">
                                    Trả phí ·{" "}
                                    {formatVndPrice(e.paid_amount_vnd)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {e.paid_provider
                                      ? `Provider: ${e.paid_provider}`
                                      : "Provider: —"}
                                    {e.paid_order_id
                                      ? ` · Order: ${e.paid_order_id}`
                                      : ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Miễn phí / chưa ghi nhận
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {e.enrolled_at
                                ? new Date(e.enrolled_at).toLocaleDateString(
                                    "vi-VN",
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {e.last_accessed_at
                                ? new Date(
                                    e.last_accessed_at,
                                  ).toLocaleDateString(intlLocale())
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "danger" && canAccessDanger && (
            <section className="rounded-md border border-destructive/30 bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-2">
                <AlertTriangle className="size-5" aria-hidden /> Vùng nguy hiểm
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Xoá khoá học sẽ xoá toàn bộ nội dung (chương, bài học). Hành
                động này không thể hoàn tác.
              </p>
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      type="button"
                    >
                      <Trash2 className="size-4" aria-hidden /> Xoá khoá học
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("courseEdit.danger.deleteCourseTitle")}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Toàn bộ nội dung (chương, bài học) sẽ bị xoá. Hành động này
                    không thể hoàn tác.
                  </p>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => void handleDeleteCourse()}
                    >
                      Xoá
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default InstructorCourseEdit;
