import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowLineDown,
  ArrowLineUp,
  Plus,
  Spinner,
  Trash,
  List,
  PlayCircle,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Gear,
  Money,
  Warning,
  Certificate,
  DownloadSimple,
  DotsSixVertical,
} from "@phosphor-icons/react";
import {
  getCourse,
  getCourseSections,
  getCourseLessons,
  getEnrollmentsForCourse,
  getLessonProgressForCourse,
  computeProgressPercent,
  checkAndIssueCertificate,
  updateCourse,
  addSection,
  addLesson,
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
import { getProfile } from "@/lib/profile";
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
  COURSE_ACCESS_MODEL_LABELS,
  COURSE_LEVEL_LABELS,
  COURSE_OWNER_TYPE_LABELS,
  getCourseOwnerTypeLabel,
  formatVndPrice,
  formatDuration,
  type PartnerCourseDocument,
  type CourseOwnerType,
  type CourseAccessModel,
  type CourseLevel,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const normalizeVndDigits = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const formatVndInput = (value: string) =>
  value ? Number(value).toLocaleString("vi-VN") : "";

const EDIT_SECTION_IDS = [
  "info",
  "pricing",
  "content",
  "assignments",
  "certificate",
  "students",
  "danger",
] as const;

type LessonDropPosition = "before" | "after";

type LessonDropTarget = {
  sectionId: string;
  lessonId: string;
  position: LessonDropPosition;
};

const getNextOrder = (items: Array<{ order?: number | null }>) =>
  items.reduce((max, item) => Math.max(max, Number(item.order ?? -1)), -1) + 1;

const InstructorCourseEdit = () => {
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
  const [addingLessonSectionId, setAddingLessonSectionId] = useState<
    string | null
  >(null);
  const [addingLessonInProgress, setAddingLessonInProgress] = useState(false);
  const [reorderingLessons, setReorderingLessons] = useState(false);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [draggingLessonSectionId, setDraggingLessonSectionId] = useState<
    string | null
  >(null);
  const [lessonDropTarget, setLessonDropTarget] =
    useState<LessonDropTarget | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonYoutubeUrl, setNewLessonYoutubeUrl] = useState("");
  const [newLessonMinutes, setNewLessonMinutes] = useState<number | "">("");
  const [newLessonIsPreviewFree, setNewLessonIsPreviewFree] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    short_description: "",
    description: "",
    thumbnail_url: "",
    level: "all" as CourseLevel,
    published: false,
    final_assignment_title: "",
    final_assignment_description: "",
    final_assignment_instructions: "",
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
    course &&
    (isAdmin || isSupportStaff || course.instructor_id === profile?.id);

  useEffect(() => {
    if (!id || !canEdit) return;
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
  }, [id, canEdit]);

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title,
        slug: course.slug,
        short_description: course.short_description ?? "",
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        level: course.level,
        published: course.published,
        final_assignment_title: course.final_assignment_title ?? "",
        final_assignment_description: course.final_assignment_description ?? "",
        final_assignment_instructions:
          course.final_assignment_instructions ?? "",
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
    }
  }, [course]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      getCourse(id),
      getCourseSections(id),
      getCourseLessons(id),
      getEnrollmentsForCourse(id),
      getSubmissionsForCourse(id),
    ])
      .then(async ([c, secs, less, enrs, subs]) => {
        if (!cancelled) {
          setCourse(c ?? null);
          setSections(secs);
          setLessons(less);
          setEnrollments(enrs);
          setSubmissions(subs);
          const subByUser: Record<string, FinalAssignmentSubmission> = {};
          for (const s of subs) subByUser[s.user_id] = s;
          setSubmissionByUser(subByUser);
          const profiles: Record<string, Profile | null> = {};
          const progress: Record<string, number> = {};
          for (const e of enrs) {
            // Instructors may not have permission to read arbitrary profile docs.
            // Fallback to null profile instead of failing the whole page.
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
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Lỗi tải khoá học");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      toast.success(
        "Đã cập nhật tổng thời lượng. Trang danh sách khoá học sẽ hiển thị đúng.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi cập nhật");
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
      setError(e instanceof Error ? e.message : "Lỗi tải ảnh bìa khoá học");
    } finally {
      setUploadingThumb(false);
      e.target.value = "";
    }
  };

  const saveCourseInfo = async (successMessage = "Đã lưu thay đổi.") => {
    if (!id || !course) return;
    if (form.access_model === "paid_upfront" && Number(form.price_vnd) <= 0) {
      setError("Nhập giá khoá học hợp lệ cho mô hình trả phí trước.");
      return;
    }
    if (
      form.access_model === "paid_upfront" &&
      form.promo_price_vnd &&
      Number(form.promo_price_vnd) >= Number(form.price_vnd || 0)
    ) {
      setError("Giá khuyến mãi phải nhỏ hơn giá gốc.");
      return;
    }
    if (form.access_model === "paid_upfront" && form.promo_ends_at) {
      const ts = Date.parse(form.promo_ends_at);
      if (!Number.isFinite(ts)) {
        setError(
          "Thời gian kết thúc khuyến mãi không hợp lệ (cần ISO string).",
        );
        return;
      }
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
      await updateCourse(id, {
        title: form.title,
        slug: form.slug,
        short_description: form.short_description.trim() || undefined,
        description: form.description,
        thumbnail_url: form.thumbnail_url,
        level: form.level,
        published: form.published,
        final_assignment_title: form.final_assignment_title.trim() || null,
        final_assignment_description:
          form.final_assignment_description.trim() || null,
        final_assignment_instructions:
          form.final_assignment_instructions.trim() || null,
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
      });
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              title: form.title,
              slug: form.slug,
              short_description: form.short_description,
              description: form.description,
              thumbnail_url: form.thumbnail_url,
              level: form.level,
              published: form.published,
              final_assignment_title: form.final_assignment_title,
              final_assignment_description: form.final_assignment_description,
              final_assignment_instructions: form.final_assignment_instructions,
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
              updated_at: new Date().toISOString(),
            }
          : null,
      );
      toast.success(successMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi cập nhật");
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
          ? "Đã duyệt bài. Chứng nhận sẽ được cấp nếu học viên đã hoàn thành 100% bài học."
          : "Đã từ chối bài.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi xử lý");
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
      toast.success("Đã tải template chứng nhận lên.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Lỗi tải template chứng nhận",
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
          ? "Đã tải lên hồ sơ hợp đồng."
          : "Đã tải lên hồ sơ hoá đơn.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải tài liệu đối tác");
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
        order: getNextOrder(sections),
      });
      setSections((prev) => [...prev, sec]);
      setNewSectionTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi thêm chương");
    } finally {
      setAddingSection(false);
    }
  };

  const handleAddLesson = async (sectionId: string) => {
    if (!id || !newLessonYoutubeUrl.trim()) return;
    const secLessons = lessons.filter((l) => l.section_id === sectionId);
    setAddingLessonInProgress(true);
    try {
      const fromApi = await getYoutubeVideoDuration(newLessonYoutubeUrl.trim());
      const fromInput =
        newLessonMinutes !== "" && Number(newLessonMinutes) > 0
          ? Number(newLessonMinutes) * 60
          : 0;
      const durationSeconds = fromInput > 0 ? fromInput : fromApi;
      const les = await addLesson(id, {
        section_id: sectionId,
        title: newLessonTitle.trim() || "Bài học",
        youtube_url: newLessonYoutubeUrl.trim(),
        duration_seconds: durationSeconds,
        order: getNextOrder(secLessons),
        is_preview_free:
          form.access_model === "paid_upfront" ? newLessonIsPreviewFree : false,
      });
      setLessons((prev) => [...prev, les]);
      setNewLessonTitle("");
      setNewLessonYoutubeUrl("");
      setNewLessonMinutes("");
      setNewLessonIsPreviewFree(false);
      setAddingLessonSectionId(null);
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi thêm bài học");
    } finally {
      setAddingLessonInProgress(false);
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
      setError(e instanceof Error ? e.message : "Lỗi cập nhật bài học thử");
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!id || !confirm("Xoá chương và toàn bộ bài học trong chương?")) return;
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
      setError(e instanceof Error ? e.message : "Lỗi xoá chương");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!id || !confirm("Xoá bài học?")) return;
    try {
      await deleteLesson(id, lessonId);
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi xoá bài học");
    }
  };

  const handleDeleteCourse = async () => {
    if (
      !id ||
      !confirm("Xoá toàn bộ khoá học và nội dung? Không thể hoàn tác.")
    )
      return;
    try {
      await deleteCourse(id);
      window.location.href = "/instructor/courses";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi xoá khoá học");
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
        e instanceof Error ? e.message : "Không thể cập nhật thứ tự bài học";
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="mx-auto max-w-[1990px] px-4 py-8">
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

  if (!course || !canEdit) {
    return (
      <div className="mx-auto max-w-[1990px] px-4 py-8">
        <p className="text-muted-foreground">
          Bạn không có quyền sửa khoá học này.
        </p>
        <Link
          to="/instructor/courses"
          className="mt-4 inline-flex items-center gap-2 text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Quản lý giảng dạy
        </Link>
      </div>
    );
  }

  const editorStats = [
    { label: "Chương", value: String(sections.length), icon: List },
    { label: "Bài học", value: String(lessons.length), icon: PlayCircle },
    { label: "Học viên", value: String(enrollments.length), icon: Users },
    { label: "Bài nộp", value: String(submissions.length), icon: FileText },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-6 rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {course.published ? "Đã xuất bản" : "Bản nháp"}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {COURSE_ACCESS_MODEL_LABELS[course.access_model ?? "free"]}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {COURSE_LEVEL_LABELS[course.level]}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {editorStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-border-subtle bg-muted/25 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" weight="duotone" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Sidebar inner — điều hướng từng phần */}
        <nav className="h-fit shrink-0 rounded-2xl border border-border-subtle bg-card p-3 shadow-card xl:sticky xl:top-24 xl:w-64">
          <div className="mb-3 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Điều hướng chỉnh sửa
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Đi qua từng nhóm cấu hình để hoàn thiện khoá học trước khi xuất bản.
            </p>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
            <li>
              <button
                type="button"
                onClick={() => setSection("info")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "info"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Gear className="size-4 shrink-0" weight="duotone" />
                Thông tin chung
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSection("pricing")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "pricing"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Money className="size-4 shrink-0" weight="duotone" />
                Giá & thanh toán
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSection("content")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "content"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <List className="size-4 shrink-0" weight="duotone" />
                Nội dung & bài học
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSection("assignments")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "assignments"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <FileText className="size-4 shrink-0" weight="duotone" />
                Bài tập cuối khoá
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSection("certificate")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "certificate"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Certificate className="size-4 shrink-0" weight="duotone" />
                Chứng nhận
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSection("students")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "students"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Users className="size-4 shrink-0" weight="duotone" />
                Quản lý học viên
              </button>
            </li>
            <li className="mt-2 border-t border-border-subtle pt-2">
              <button
                type="button"
                onClick={() => setSection("danger")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Warning className="size-4 shrink-0" weight="duotone" />
                Xoá khoá học
              </button>
            </li>
          </ul>
        </nav>

        {/* Nội dung theo section đang chọn */}
        <div className="min-w-0 flex-1">
          {activeSection === "info" && (
            <section className="rounded-lg border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground">
                Thông tin chung
              </h2>
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel>Tên khoá học</FieldLabel>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, title: e.target.value }))
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
                    className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={4}
                  />
                </Field>
                <Field>
                  <FieldLabel>Ảnh bìa khoá học</FieldLabel>
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
                      {uploadingThumb ? "Đang tải ảnh..." : "Tải ảnh bìa lên"}
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
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
                            className="min-h-[90px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                            placeholder="Ví dụ: Ngân hàng, số tài khoản, chủ tài khoản, nội dung chuyển khoản theo hợp đồng..."
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Hiển thị cho giảng viên đối tác trong mục Hoá đơn &
                            thanh toán.
                          </p>
                        </Field>
                        <Field>
                          <FieldLabel>Hồ sơ hợp đồng đối tác</FieldLabel>
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
                          <FieldLabel>Hồ sơ hoá đơn / đối soát</FieldLabel>
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
                  <FieldLabel>Cấp độ</FieldLabel>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        level: e.target.value as CourseLevel,
                      }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        setForm((p) => ({ ...p, published: e.target.checked }))
                      }
                      className="rounded border-input"
                    />
                    <span className="text-sm font-medium">
                      Đã xuất bản (hiển thị trên trang Khoá học)
                    </span>
                  </label>
                </Field>
              </FieldGroup>
              <Button
                className="mt-4"
                onClick={() => void saveCourseInfo("Đã lưu thông tin chung.")}
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </section>
          )}

          {activeSection === "pricing" && (
            <section className="rounded-lg border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                <Money className="size-5" /> Giá & thanh toán
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Thiết lập mô hình truy cập, giá khoá học, phí chứng nhận và mã
                giảm giá.
              </p>

              <FieldGroup className="mt-4">
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
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <>
                    <Field>
                      <FieldLabel>Giá mở toàn bộ khoá học (VND)</FieldLabel>
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
                      <FieldLabel>Giá khuyến mãi (VND)</FieldLabel>
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
                        placeholder="Để trống nếu không khuyến mãi"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Giá khuyến mãi phải nhỏ hơn giá gốc.
                      </p>
                    </Field>

                    <Field>
                      <FieldLabel>Hẹn giờ kết thúc khuyến mãi (ISO)</FieldLabel>
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

                    <div className="rounded-lg border border-border-subtle bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Mã giảm giá & khuyến mãi
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tạo mã giảm giá (theo % hoặc số tiền) và giới hạn
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
                          {loadingDiscounts ? "Đang tải..." : "Tải lại"}
                        </Button>
                      </div>

                      {discounts.length === 0 ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Chưa có mã giảm giá nào.
                        </p>
                      ) : (
                        <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background">
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
                                        {d.active ? "Tắt" : "Bật"}
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
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                toast.success("Đã tạo mã giảm giá.");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error
                                    ? e.message
                                    : "Không tạo được mã giảm giá.",
                                );
                              } finally {
                                setCreatingDiscount(false);
                              }
                            }}
                          >
                            {creatingDiscount ? "Đang tạo..." : "Tạo mã"}
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
                  void saveCourseInfo("Đã lưu thay đổi giá & thanh toán.")
                }
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </section>
          )}

          {activeSection === "content" && (
            <section className="rounded-lg border border-border-subtle bg-card p-6">
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
                    disabled={refreshingTotal || lessons.length === 0}
                    onClick={() => void handleRefreshTotalDuration()}
                  >
                    {refreshingTotal
                      ? "Đang cập nhật…"
                      : "Cập nhật tổng thời lượng"}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Kéo biểu tượng chấm để đổi thứ tự bài trong từng chương, hoặc
                dùng mũi tên lên/xuống khi cần.
              </p>

              <div className="mt-4 space-y-6">
                {form.access_model === "paid_upfront" && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                    Khoá học trả phí trước: bật "Học thử miễn phí" cho các bài
                    muốn mở cho học viên chưa thanh toán.
                  </div>
                )}
                {lessonsBySection.map(({ section, lessons: secLessons }) => (
                  <div
                    key={section.id}
                    className="rounded-lg border border-border-subtle bg-card overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-border-subtle bg-muted/40 px-4 py-2.5">
                      <span className="font-medium text-foreground">
                        {section.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        <Trash className="size-4" />
                      </Button>
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
                              "flex flex-col gap-2 px-4 py-2.5 transition-[background-color,border-color,opacity] md:flex-row md:items-center md:justify-between",
                              isDragging && "opacity-45",
                              isDropBefore && "border-t-2 border-primary bg-primary/5",
                              isDropAfter && "border-b-2 border-primary bg-primary/5",
                            )}
                          >
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
                                title="Kéo để đổi thứ tự"
                                className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:border-border-subtle hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <DotsSixVertical className="size-4" />
                              </button>
                              <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                              <span className="text-sm text-foreground truncate">
                                {lesson.title}
                              </span>
                              {form.access_model === "paid_upfront" &&
                                lesson.is_preview_free && (
                                  <span className="rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                                    Học thử
                                  </span>
                                )}
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDuration(lesson.duration_seconds)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={reorderingLessons || lessonIndex === 0}
                                onClick={() =>
                                  void handleMoveLesson(section.id, lesson.id, -1)
                                }
                                aria-label={`Đưa bài ${lesson.title} lên trên`}
                                title="Đưa lên trên"
                              >
                                <ArrowLineUp className="size-4" />
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
                                title="Đưa xuống dưới"
                              >
                                <ArrowLineDown className="size-4" />
                              </Button>
                              {form.access_model === "paid_upfront" && (
                                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
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
                                <Trash className="size-4" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="border-t border-border-subtle p-3">
                      {addingLessonSectionId === section.id ? (
                        <div className="flex flex-col gap-2">
                          <Input
                            placeholder="Link YouTube *"
                            value={newLessonYoutubeUrl}
                            onChange={(e) =>
                              setNewLessonYoutubeUrl(e.target.value)
                            }
                          />
                          <Input
                            placeholder="Tên bài (tùy chọn)"
                            value={newLessonTitle}
                            onChange={(e) => setNewLessonTitle(e.target.value)}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Thời lượng (phút) — nếu không lấy được từ YouTube, nhập vào đây"
                            value={
                              newLessonMinutes === "" ? "" : newLessonMinutes
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setNewLessonMinutes(
                                v === ""
                                  ? ""
                                  : Math.max(0, parseInt(v, 10) || 0),
                              );
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Thời lượng: ưu tiên từ ô phút phía trên; nếu để
                            trống sẽ lấy từ YouTube API (cần
                            VITE_YOUTUBE_API_KEY).
                          </p>
                          {form.access_model === "paid_upfront" && (
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={newLessonIsPreviewFree}
                                onChange={(e) =>
                                  setNewLessonIsPreviewFree(e.target.checked)
                                }
                                className="rounded border-input"
                              />
                              Bật bài học thử miễn phí
                            </label>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddLesson(section.id)}
                              disabled={
                                !newLessonYoutubeUrl.trim() ||
                                addingLessonInProgress
                              }
                            >
                              {addingLessonInProgress ? "Đang thêm…" : "Thêm"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAddingLessonSectionId(null);
                                setNewLessonTitle("");
                                setNewLessonYoutubeUrl("");
                                setNewLessonMinutes("");
                                setNewLessonIsPreviewFree(false);
                              }}
                            >
                              Huỷ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddingLessonSectionId(section.id)}
                          className="inline-flex items-center gap-1"
                        >
                          <Plus className="size-4" /> Thêm bài học
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-border-subtle p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Thêm chương mới
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tên chương"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                  />
                  <Button
                    onClick={() => void handleAddSection()}
                    disabled={addingSection || !newSectionTitle.trim()}
                  >
                    {addingSection ? "Đang thêm..." : "Thêm chương"}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {activeSection === "assignments" && (
            <section className="rounded-lg border border-border-subtle bg-card p-6">
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
              <p className="text-sm text-muted-foreground mb-6">
                Nếu có, học viên phải nộp và được duyệt mới đủ điều kiện nhận
                chứng nhận.
              </p>

              <div className="mb-8 rounded-lg border border-border-subtle bg-muted/20 p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Cấu hình bài tập
                </h3>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Tiêu đề bài tập</FieldLabel>
                    <Input
                      placeholder="VD: Dự án cuối khoá (để trống = không yêu cầu)"
                      value={form.final_assignment_title}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          final_assignment_title: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Mô tả / yêu cầu</FieldLabel>
                    <textarea
                      placeholder="Mô tả chi tiết bài tập học viên cần làm..."
                      value={form.final_assignment_description}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          final_assignment_description: e.target.value,
                        }))
                      }
                      className="min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={3}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Hướng dẫn (tùy chọn)</FieldLabel>
                    <textarea
                      placeholder="Hướng dẫn thêm cho học viên..."
                      value={form.final_assignment_instructions}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          final_assignment_instructions: e.target.value,
                        }))
                      }
                      className="min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2}
                    />
                  </Field>
                  <Button
                    onClick={() =>
                      void saveCourseInfo("Đã lưu cấu hình bài tập.")
                    }
                    disabled={saving}
                  >
                    {saving ? "Đang lưu..." : "Lưu cấu hình bài tập"}
                  </Button>
                </FieldGroup>
              </div>

              <h3 className="text-sm font-medium text-foreground mb-3">
                Bài nộp của học viên
              </h3>
              {course.final_assignment_title ? (
                <>
                  {submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Chưa có bài nộp nào.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border-subtle">
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
                                  ).toLocaleDateString("vi-VN")}
                                </td>
                                <td className="px-4 py-3">
                                  {sub.status === "approved" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                      <CheckCircle className="size-3.5" /> Đã
                                      duyệt
                                    </span>
                                  ) : sub.status === "rejected" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                                      <XCircle className="size-3.5" /> Từ chối
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
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
                                          : "Duyệt"}
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

          {activeSection === "certificate" && (
            <section className="rounded-lg border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-4">
                <Certificate className="size-5" weight="duotone" /> Template
                chứng nhận
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Tải lên ảnh template chứng nhận (PNG/JPG). Tên học viên sẽ được
                hiển thị tại vị trí bạn chọn (theo % từ trái và từ trên).
              </p>

              <div className="mb-8 space-y-4">
                <Field>
                  <FieldLabel>Template chứng nhận</FieldLabel>
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
                      {uploadingCert ? "Đang tải lên..." : "Tải template lên"}
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
                  <FieldLabel>Vị trí tên học viên ( % từ trái )</FieldLabel>
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
                  <FieldLabel>Vị trí tên học viên ( % từ trên )</FieldLabel>
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
                    void saveCourseInfo("Đã lưu cấu hình chứng nhận.")
                  }
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu vị trí tên"}
                </Button>
              </div>

              <div className="rounded-lg border border-border-subtle bg-muted/20 p-4">
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
                    Sau khi tải lên, chỉnh hai ô "Vị trí tên" ( % từ trái / % từ
                    trên ) để tên học viên nằm đúng vùng trống. 50% = giữa.
                  </li>
                  <li>Định dạng: PNG hoặc JPG.</li>
                </ul>
                <div className="mt-4">
                  <a
                    href="/certificate-template-sample.svg"
                    download="certificate-template-sample.svg"
                    className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <DownloadSimple className="size-4" /> Tải template mẫu (SVG)
                  </a>
                </div>
              </div>
            </section>
          )}

          {activeSection === "students" && (
            <section className="rounded-lg border border-border-subtle bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-4">
                <Users className="size-5" /> Quản lý học viên
              </h2>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Chưa có học viên nào ghi danh vào khoá học này.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border-subtle">
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
                                    <span className="text-amber-600 text-xs">
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
                                  <CheckCircle className="size-3.5" /> Đã cấp
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
                                  <div className="text-[11px] text-muted-foreground">
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
                                  ).toLocaleDateString("vi-VN")
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

          {activeSection === "danger" && (
            <section className="rounded-lg border border-destructive/30 bg-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-2">
                <Warning className="size-5" weight="duotone" /> Vùng nguy hiểm
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
                      <Trash className="size-4" /> Xoá khoá học
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Xoá khoá học?</DialogTitle>
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
    </div>
  );
};

export default InstructorCourseEdit;
