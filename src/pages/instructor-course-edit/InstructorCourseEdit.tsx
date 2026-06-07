import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Plus,
  List,
  Mail,
  PlayCircle,
  Users,
  FileText,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Award,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Download,
  GripVertical,
  Loader2,
  PenLine,
  Settings,
  DollarSign,
  Trash2,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  getCourse,
  getCourseSections,
  getCourseLessons,
  getEnrollmentsForCourse,
  getLessonProgressForCourse,
  getLessonDistinctLearnerCountsForCourse,
  computeProgressPercent,
  checkAndIssueCertificate,
  updateCourse,
  isCourseCoInstructorWithAnyPermission,
  toCoInstructorSnapshot,
  applyCourseLessonLocaleContent,
  applyCourseSectionLocaleContent,
  getCourseLessonLocaleContent,
  getCourseLessonLocaleContentMap,
  getCourseLocaleContent,
  getCoursePrimaryLocale,
  getCourseSectionLocaleContent,
  getCourseSectionLocaleContentMap,
  getCourseSupportedLocales,
  normalizeCourseLocale,
  setCourseLessonLocaleContent,
  setCourseLocaleContent,
  setCourseSectionLocaleContent,
  addSection,
  addLesson,
  getOrCreateDefaultSection,
  updateSection,
  updateLesson,
  reorderCourseLessons,
  reorderCourseSections,
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
import { fetchYoutubeVideoMetadata, getYoutubeVideoDuration } from "@/lib/youtube";
import {
  buildSegmentsFromChapterStarts,
  formatSecondsToTimestamp,
  parseChaptersFromDescription,
  parseTimestampLabelToSeconds,
  type LessonSegmentFromYoutube,
  type ParsedChapterStart,
} from "@/lib/youtubeChapters";
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
  uploadCourseSponsorLogo,
  uploadCoursePartnerLogo,
  deleteStorageObjectByPath,
} from "@/lib/storage";
import {
  getCourseOwnerTypeLabel,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  formatVndPrice,
  formatDuration,
  getYoutubeVideoId,
  type PartnerCourseDocument,
  type CourseOwnerType,
  type CourseAccessModel,
  type CourseLevel,
  type SupportedCourseLocale,
  type CourseCoInstructorPermissions,
  type CourseSponsor,
  type CoursePartner,
} from "@/types/courses";
import type {
  Course,
  CourseSection,
  CourseSectionLocaleContent,
  CourseLesson,
  CourseLessonLocaleContent,
  Enrollment,
  FinalAssignmentSubmission,
  LessonFormat,
} from "@/types/courses";
import { LessonFormatSelector } from "@/components/course/LessonFormatSelector";
import {
  getLessonFormat,
  getNextActivityLessonTitle,
  isLessonDraftForLearners,
} from "@/lib/lessonFormat";
import type { Profile } from "@/types/database";
import { useAuth } from "@/stores/authStore";
import { trackLoadingPromise } from "@/stores/loadingStore";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Markdown } from "@/components/markdown/Markdown";
import {
  invokeGenerateDescription,
  type DescriptionSourceInput,
  type DescriptionTranslationBundle,
  type DescriptionTranslationBundleKind,
} from "@/lib/descriptionGenerator";
import {
  invokeGenerateQuestions,
  type GeneratedQuestionSource,
} from "@/lib/questionGenerator";
import { setLessonQuestions } from "@/lib/sectionQuestions";
import type { QuestionOption, SectionQuestionData } from "@/types/questions";
import type {
  DescriptionGeneratorDialogRequest,
  DescriptionGeneratorSourcePreview,
} from "@/pages/instructor-course-edit/components/DescriptionGeneratorDialog";
import { DescriptionGeneratorDialog } from "@/pages/instructor-course-edit/components/DescriptionGeneratorDialog";

import { CourseOcbCredentialSection } from "@/pages/instructor-course-edit/components/CourseOcbCredentialSection";
import { QuestionGeneratorDialog } from "@/pages/instructor-course-edit/components/QuestionGeneratorDialog";
import { CO_INSTRUCTOR_PERMISSION_KEYS, EDIT_SECTION_IDS } from "./constants";
import { AnnouncementsSection } from "./components/AnnouncementsSection";
import type {
  LessonDropPosition,
  LessonDropTarget,
  SectionDropPosition,
  SectionDropTarget,
} from "./types";
import { formatVndInput, normalizeVndDigits } from "./utils/currency";
import { createSponsorId, getNextOrder, isValidHttpUrl } from "./utils/helpers";
import {
  inviteCoInstructor,
  listPendingCoInstructorInvites,
  revokeCoInstructorInvite,
  type CoInstructorInviteRow,
} from "@/lib/coInstructorInvites";

/** Gợi ý tách lesson khi video dài hơn ngưỡng này (giây). */
const LONG_VIDEO_SPLIT_SECONDS = 3600;
const QUIZ_OPTION_IDS = ["a", "b", "c", "d"] as const;
const NEW_QUIZ_COUNT_OPTIONS = [3, 5, 7, 10] as const;

type CoverageFieldKey =
  | "title"
  | "short_description"
  | "description"
  | "learning_outcomes"
  | "final_assignment_title"
  | "final_assignment_description"
  | "final_assignment_instructions";

const InstructorCourseEdit = () => {
  const { t, i18n } = useTranslation("instructor");

  const formatHumanVideoDuration = (totalSeconds: number) => {
    if (!(totalSeconds > 0)) return "—";
    const loc = i18n.resolvedLanguage ?? i18n.language;
    if (loc.startsWith("vi")) return formatDuration(totalSeconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h <= 0) return `${m} min`;
    return `${h} hr ${m} min`;
  };
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [sectionLocaleMap, setSectionLocaleMap] = useState<Map<string, CourseSectionLocaleContent>>(new Map());
  const [lessonLocaleMap, setLessonLocaleMap] = useState<Map<string, CourseLessonLocaleContent>>(new Map());
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
  const [reorderingSections, setReorderingSections] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [sectionDropTarget, setSectionDropTarget] =
    useState<SectionDropTarget | null>(null);
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
  const [newPracticeSourceLessonId, setNewPracticeSourceLessonId] = useState("");
  const [newPracticeSourceLessonIds, setNewPracticeSourceLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const [newLessonFormat, setNewLessonFormat] = useState<LessonFormat>("video");
  type NewQuizQuestionDraft = SectionQuestionData & { _key: string };
  const makeBlankNewQuizQuestion = (): NewQuizQuestionDraft => ({
    _key: crypto.randomUUID(),
    type: "mcq",
    question: "",
    options: QUIZ_OPTION_IDS.map((optionId) => ({ id: optionId, text: "" })),
    correct_index: 0,
    explanation: "",
    locale: activeContentLocale,
  });
  const questionDataToNewQuizDraft = (
    question: SectionQuestionData,
  ): NewQuizQuestionDraft => ({
    _key: crypto.randomUUID(),
    type: "mcq",
    question: question.question ?? "",
    options: QUIZ_OPTION_IDS.map((optionId, index) => ({
      id: optionId,
      text: question.options[index]?.text ?? "",
    })),
    correct_index: question.correct_index ?? 0,
    explanation: question.explanation ?? "",
    locale: activeContentLocale,
  });
  const [newQuizQuestions, setNewQuizQuestions] = useState<NewQuizQuestionDraft[]>([]);
  const [newQuizSourceLessonIds, setNewQuizSourceLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const [newQuizQuestionCount, setNewQuizQuestionCount] = useState<number>(5);
  const [newQuizGenerating, setNewQuizGenerating] = useState(false);
  const [newQuizGenerateError, setNewQuizGenerateError] = useState<string | null>(null);
  const [newQuizGeneratedSources, setNewQuizGeneratedSources] = useState<
    GeneratedQuestionSource[]
  >([]);
  const [editingLessonFormat, setEditingLessonFormat] = useState<LessonFormat>("video");
  const [editingLessonMinutes, setEditingLessonMinutes] = useState<number | "">("");
  const [lessonLearnerCounts, setLessonLearnerCounts] = useState<Record<string, number>>({});
  const [longVideoSplitOpen, setLongVideoSplitOpen] = useState(false);
  const [longVideoSplitPayload, setLongVideoSplitPayload] = useState<{
    sectionId: string;
    youtubeUrl: string;
    videoDurationSeconds: number;
    chapterStarts: ParsedChapterStart[];
    autoSegments: LessonSegmentFromYoutube[];
    replaceContext?: {
      replaceLessonId: string;
      orderedSectionLessonIds: string[];
    };
  } | null>(null);
  const [longVideoSplitUiMode, setLongVideoSplitUiMode] = useState<"choose" | "manual">("choose");
  const [manualSegmentRows, setManualSegmentRows] = useState<
    Array<{ start: string; end: string; title: string }>
  >([{ start: "0:00", end: "", title: "" }]);
  const pendingNewLessonSnapRef = useRef<{
    title: string;
    shortDescription: string;
    markdown: string;
    resources: Array<{ title: string; url: string }>;
    minutes: number | "";
    isPreviewFree: boolean;
    videoPrimaryLocale?: SupportedCourseLocale;
    hasSubtitle?: boolean;
    subtitleLocales?: SupportedCourseLocale[];
  } | null>(null);
  const suppressLongVideoDismissRestoreRef = useRef(false);
  const [editingLessonYoutubeStartLabel, setEditingLessonYoutubeStartLabel] = useState("0:00");
  const [editingLessonYoutubeEndLabel, setEditingLessonYoutubeEndLabel] = useState("");
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
  const [editingPracticeSourceLessonId, setEditingPracticeSourceLessonId] = useState("");
  const [editingPracticeSourceLessonIds, setEditingPracticeSourceLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const courseFieldRefs = useRef<
    Partial<
      Record<
        | "title"
        | "short_description"
        | "description"
        | "learning_outcomes"
        | "final_assignment_title"
        | "final_assignment_description"
        | "final_assignment_instructions",
        HTMLDivElement | null
      >
    >
  >({});
  const [form, setForm] = useState({
    slug: "",
    thumbnail_url: "",
    level: "all" as CourseLevel,
    published: false,
    is_external_aggregated: false,
    is_updating: false,
    has_certificate: false,
    has_sections: true,
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
    external_source_urls_text: "",
    external_source_attribution_note: "",
  });

  const [coInstructorIds, setCoInstructorIds] = useState<string[]>([]);
  const [coInstructorPermissions, setCoInstructorPermissions] = useState<
    Record<string, CourseCoInstructorPermissions>
  >({});
  const [instructorDirectory, setInstructorDirectory] = useState<Profile[]>([]);
  const [loadingInstructorDirectory, setLoadingInstructorDirectory] =
    useState(false);
  // Pending invites for this course (manager view). Source of truth = DB.
  const [pendingCoInstructorInvites, setPendingCoInstructorInvites] = useState<
    CoInstructorInviteRow[]
  >([]);
  // Snapshot of ids that were already accepted at load-time. Used to decide
  // which uids in coInstructorIds need an invite (newly added) vs perms update.
  const [acceptedCoInstructorIdsSnapshot, setAcceptedCoInstructorIdsSnapshot] =
    useState<string[]>([]);
  // Per co-instructor visibility on course details page (default: true).
  const [coInstructorVisibility, setCoInstructorVisibility] = useState<Record<string, boolean>>({});

  const [supportedLocales, setSupportedLocales] = useState<SupportedCourseLocale[]>(["vi", "en"]);
  const [primaryContentLocale, setPrimaryContentLocale] = useState<SupportedCourseLocale>("vi");
  const [defaultVideoPrimaryLocale, setDefaultVideoPrimaryLocale] =
    useState<SupportedCourseLocale>("vi");
  const [activeContentLocale, setActiveContentLocale] = useState<SupportedCourseLocale>("vi");
  // Per-locale draft cache for section & lesson dialogs
  type SectionDraft = { title: string; description: string };
  type LessonDraft = {
    title: string; youtubeUrl: string; videoPrimaryLocale: SupportedCourseLocale;
    hasSubtitle: boolean; subtitleLocales: SupportedCourseLocale[];
    shortDescription: string; markdown: string;
    resources: Array<{ title: string; url: string }>;
    practiceSourceLessonId: string;
    practiceSourceLessonIds: string[];
  };
  const sectionDraftRef = useRef<Map<SupportedCourseLocale, SectionDraft>>(new Map());
  const lessonDraftRef = useRef<Map<SupportedCourseLocale, LessonDraft>>(new Map());
  const [dialogSectionLocale, setDialogSectionLocale] = useState<SupportedCourseLocale>("vi");
  const [dialogLessonLocale, setDialogLessonLocale] = useState<SupportedCourseLocale>("vi");
  const [contentForm, setContentForm] = useState({
    title: "",
    short_description: "",
    description: "",
    learning_outcomes: [] as string[],
    final_assignment_title: "",
    final_assignment_description: "",
    final_assignment_instructions: "",
  });
  const [descriptionGeneratorOpen, setDescriptionGeneratorOpen] = useState(false);
  const [descriptionGeneratorRequest, setDescriptionGeneratorRequest] =
    useState<DescriptionGeneratorDialogRequest | null>(null);
  const [translatingBundle, setTranslatingBundle] = useState<string | null>(null);
  const [questionGeneratorOpen, setQuestionGeneratorOpen] = useState(false);
  const [questionGeneratorSection, setQuestionGeneratorSection] = useState<CourseSection | null>(null);
  const [lessonQuizDialogOpen, setLessonQuizDialogOpen] = useState(false);
  const [lessonQuizDialogLesson, setLessonQuizDialogLesson] = useState<CourseLesson | null>(null);
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
  const [issuingCertForUser, setIssuingCertForUser] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const certificateInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingContractDoc, setUploadingContractDoc] = useState(false);
  const [uploadingInvoiceDoc, setUploadingInvoiceDoc] = useState(false);
  const [sponsors, setSponsors] = useState<CourseSponsor[]>([]);
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const [activeSponsorId, setActiveSponsorId] = useState<string | null>(null);
  type LocaleContentDraft = { name: string; description: string };
  const [sponsorForm, setSponsorForm] = useState<{
    website: string;
    logo_url: string;
    logo_path: string;
    locale_content: { vi: LocaleContentDraft; en: LocaleContentDraft };
  }>({
    website: "",
    logo_url: "",
    logo_path: "",
    locale_content: { vi: { name: "", description: "" }, en: { name: "", description: "" } },
  });
  const [sponsorDialogLocale, setSponsorDialogLocale] = useState<SupportedCourseLocale>("vi");
  const sponsorLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingSponsorLogo, setUploadingSponsorLogo] = useState(false);
  const [partners, setPartners] = useState<CoursePartner[]>([]);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState<{
    website: string;
    logo_url: string;
    logo_path: string;
    locale_content: { vi: LocaleContentDraft; en: LocaleContentDraft };
  }>({
    website: "",
    logo_url: "",
    logo_path: "",
    locale_content: { vi: { name: "", description: "" }, en: { name: "", description: "" } },
  });
  const [partnerDialogLocale, setPartnerDialogLocale] = useState<SupportedCourseLocale>("vi");
  const partnerLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPartnerLogo, setUploadingPartnerLogo] = useState(false);
  const [ocbIsActive, setOcbIsActive] = useState(false);
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
    | "announcements"
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
  const canAccessAnnouncements = Boolean(
    canEdit || isCourseCoInstructorWithAnyPermission(course, profile?.id),
  );

  useEffect(() => {
    const allowed: SectionId[] = [];
    if (canAccessInfo) allowed.push("info");
    if (canAccessPricing) allowed.push("pricing");
    if (canAccessContent) allowed.push("content");
    if (canAccessAssignments) allowed.push("assignments");
    if (canAccessCertificate) allowed.push("certificate");
    if (canAccessAnnouncements) allowed.push("announcements");
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
    canAccessAnnouncements,
    canAccessStudents,
    canAccessDanger,
  ]);

  const canEditCoInstructors = Boolean(
    course && (isAdmin || isSupportStaff || course.instructor_id === profile?.id),
  );
  const isCoreliaCourse = (form.owner_type ?? course?.owner_type ?? "corelia") === "corelia";
  const isCoreliaInstructor = profile?.instructor_origin === "corelia";
  const canManageCourseOcb = Boolean(
    course && isCoreliaCourse && (isAdmin || isSupportStaff || isCoreliaInstructor),
  );

  const createSourcePreview = (
    item: {
      id: string;
      title: string;
      shortDescription?: string | null;
      markdownDescription?: string | null;
      youtubeUrl?: string | null;
    },
  ): DescriptionGeneratorSourcePreview => {
    const sourceKinds: DescriptionGeneratorSourcePreview["sourceKinds"] = [];
    if (item.shortDescription?.trim()) sourceKinds.push("short_description");
    if (item.markdownDescription?.trim()) sourceKinds.push("description_markdown");
    if (item.youtubeUrl?.trim()) sourceKinds.push("transcript");
    if (sourceKinds.length === 0) sourceKinds.push("missing");
    const snippet =
      item.markdownDescription?.trim() ||
      item.shortDescription?.trim() ||
      undefined;
    return {
      id: item.id,
      title: item.title.trim() || t("courseEdit.defaults.lessonTitle"),
      sourceKinds,
      snippet: snippet && snippet.length > 180 ? `${snippet.slice(0, 177)}...` : snippet,
    };
  };

  const createSourceInput = (item: {
    id: string;
    title: string;
    shortDescription?: string | null;
    markdownDescription?: string | null;
    youtubeUrl?: string | null;
  }): DescriptionSourceInput => ({
    id: item.id,
    title: item.title.trim() || t("courseEdit.defaults.lessonTitle"),
    shortDescription: item.shortDescription?.trim() || undefined,
    markdownDescription: item.markdownDescription?.trim() || undefined,
    youtubeUrl: item.youtubeUrl?.trim() || undefined,
  });

  const buildGeneratorWarning = (sources: DescriptionGeneratorSourcePreview[]): string | null => {
    const usableSources = sources.filter((source) => !source.sourceKinds.includes("missing"));
    if (usableSources.length === 0) {
      return t("courseEdit.descriptionGenerator.warnings.notEnough");
    }
    if (usableSources.length < 2) {
      return t("courseEdit.descriptionGenerator.warnings.limited");
    }
    return null;
  };

  const openDescriptionGenerator = (request: DescriptionGeneratorDialogRequest) => {
    setDescriptionGeneratorRequest(request);
    setDescriptionGeneratorOpen(true);
  };

  const sourceLocaleFor = (targetLocale: SupportedCourseLocale): SupportedCourseLocale =>
    targetLocale === primaryContentLocale
      ? supportedLocales.find((loc) => loc !== targetLocale) ?? primaryContentLocale
      : primaryContentLocale;

  const localeBadge = (locale: SupportedCourseLocale) => `${locale === "vi" ? "🇻🇳" : "🇬🇧"} ${locale.toUpperCase()}`;

  const bundleHasSource = (bundle: DescriptionTranslationBundle): boolean =>
    Boolean(
      bundle.title?.trim() ||
        bundle.shortDescription?.trim() ||
        bundle.description?.trim() ||
        bundle.markdownDescription?.trim() ||
        bundle.instructions?.trim() ||
        bundle.learningOutcomes?.some((item) => item.trim()),
    );

  const translateBundle = async (params: {
    busyKey: string;
    bundleKind: DescriptionTranslationBundleKind;
    type: "course" | "lesson";
    targetLocale: SupportedCourseLocale;
    sourceLocale: SupportedCourseLocale;
    sourceBundle: DescriptionTranslationBundle;
    courseId?: string;
    sectionId?: string;
    lessonId?: string;
    onApply: (bundle: DescriptionTranslationBundle) => void;
  }) => {
    if (!bundleHasSource(params.sourceBundle)) {
      toast.error(t("courseEdit.descriptionGenerator.warnings.notEnough"));
      return;
    }
    setTranslatingBundle(params.busyKey);
    try {
      const response = await invokeGenerateDescription({
        action: "translate",
        type: params.type,
        targetField: "description",
        locale: params.targetLocale,
        sourceLocale: params.sourceLocale,
        bundleKind: params.bundleKind,
        sourceBundle: params.sourceBundle,
        courseId: params.courseId,
        sectionId: params.sectionId,
        lessonId: params.lessonId,
      });
      if (!response.bundle) {
        throw new Error(t("courseEdit.descriptionGenerator.errors.generic"));
      }
      params.onApply(response.bundle);
      toast.success(t("courseEdit.descriptionGenerator.translateApplied"));
    } catch (translateError) {
      toast.error(
        translateError instanceof Error
          ? translateError.message
          : t("courseEdit.descriptionGenerator.errors.generic"),
      );
    } finally {
      setTranslatingBundle(null);
    }
  };

  const openTranslateCourseField = (
    targetField: "short_description" | "description",
  ) => {
    if (!course) return;
    const sourceLocale = sourceLocaleFor(activeContentLocale);
    const sourceContent =
      sourceLocale === primaryContentLocale
        ? {
            title: course.title ?? "",
            short_description: course.short_description ?? "",
            description: course.description ?? "",
          }
        : {
            title: contentForm.title,
            short_description: contentForm.short_description,
            description: contentForm.description,
          };
    const sourceText =
      targetField === "short_description"
        ? sourceContent.short_description
        : sourceContent.description;
    const sourcePreviews = [
      createSourcePreview({
        id: `course-${sourceLocale}`,
        title: `${t("courseEdit.descriptionGenerator.currentCourseSource")} · ${localeBadge(sourceLocale)}`,
        shortDescription:
          targetField === "short_description" ? sourceText : undefined,
        markdownDescription:
          targetField === "description" ? sourceText : undefined,
      }),
    ];
    openDescriptionGenerator({
      title: t("courseEdit.descriptionGenerator.translateCourseTitle"),
      description: t("courseEdit.descriptionGenerator.translateCourseDescription", {
        source: sourceLocale.toUpperCase(),
        target: activeContentLocale.toUpperCase(),
      }),
      type: "course",
      targetField,
      locale: activeContentLocale,
      sourcePreviews,
      warning: buildGeneratorWarning(sourcePreviews),
      actionLabel: t("courseEdit.descriptionGenerator.translateTrigger"),
      loadingLabel: t("courseEdit.descriptionGenerator.translating"),
      requestBody: {
        action: "translate",
        type: "course",
        targetField,
        locale: activeContentLocale,
        sourceLocale,
        sourceInputs: [
          createSourceInput({
            id: `course-${sourceLocale}`,
            title: `${t("courseEdit.descriptionGenerator.currentCourseSource")} · ${localeBadge(sourceLocale)}`,
            shortDescription:
              targetField === "short_description" ? sourceText : undefined,
            markdownDescription:
              targetField === "description" ? sourceText : undefined,
          }),
        ],
        courseId: id,
      },
      onApply: (value) =>
        setContentForm((prev) => ({
          ...prev,
          [targetField]: value,
        })),
    });
  };

  useEffect(() => {
    if (!course) return;
    const acceptedIds = Object.keys(course.co_instructor_permissions ?? {})
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((cid) => cid !== course.instructor_id);
    const uniqueAccepted = Array.from(new Set(acceptedIds));
    setCoInstructorIds(uniqueAccepted);
    setCoInstructorPermissions(course.co_instructor_permissions ?? {});
    setAcceptedCoInstructorIdsSnapshot(uniqueAccepted);
    const vis: Record<string, boolean> = {};
    for (const snap of course.co_instructors ?? []) {
      vis[snap.id] = snap.show_on_course_page !== false;
    }
    setCoInstructorVisibility(vis);
  }, [course]);

  // Load pending co-instructor invites for this course (manager view).
  useEffect(() => {
    if (!course?.id || !canEditCoInstructors) return;
    let cancelled = false;
    void listPendingCoInstructorInvites(course.id)
      .then((rows) => {
        if (!cancelled) setPendingCoInstructorInvites(rows);
      })
      .catch(() => {
        if (!cancelled) setPendingCoInstructorInvites([]);
      });
    return () => {
      cancelled = true;
    };
  }, [course?.id, canEditCoInstructors]);

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
        is_external_aggregated: course.is_external_aggregated ?? false,
        is_updating: course.is_updating ?? false,
        has_certificate: course.has_certificate ?? false,
        has_sections: course.has_sections ?? true,
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
        external_source_urls_text: (course.external_source_urls ?? []).join("\n"),
        external_source_attribution_note:
          course.external_source_attribution_note ?? "",
      });
      setSponsors(Array.isArray(course.sponsors) ? course.sponsors : []);
      const list = Array.isArray(course.partners) ? course.partners : [];
      if (list.length > 0) {
        setPartners(list);
      } else {
        const legacy = course.partner_brand ?? null;
        const legacyName = String(legacy?.name ?? "").trim();
        setPartners(
          legacyName
            ? [
                {
                  id: "legacy",
                  name: legacyName,
                  website: legacy?.website ?? null,
                  description: legacy?.description ?? null,
                  logo_url: legacy?.logo_url ?? null,
                  logo_path: legacy?.logo_path ?? null,
                },
              ]
            : [],
        );
      }

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
    if (!id || activeContentLocale === primaryContentLocale) {
      setSectionLocaleMap(new Map());
      setLessonLocaleMap(new Map());
      return;
    }
    let cancelled = false;
    void Promise.all([
      getCourseSectionLocaleContentMap(id, activeContentLocale),
      getCourseLessonLocaleContentMap(id, activeContentLocale),
    ]).then(([secMap, lesMap]) => {
      if (!cancelled) {
        setSectionLocaleMap(secMap);
        setLessonLocaleMap(lesMap);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, activeContentLocale, primaryContentLocale]);

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

        if (canStudents) {
          void getLessonDistinctLearnerCountsForCourse(id)
            .then((counts) => {
              if (!cancelled) setLessonLearnerCounts(counts);
            })
            .catch(() => {});
        } else {
          setLessonLearnerCounts({});
        }

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
    if (form.is_external_aggregated) {
      const externalSources = form.external_source_urls_text
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (externalSources.length === 0) {
        setError(t("courseEdit.errors.externalSourcesRequired"));
        return;
      }
    }
    setSaving(true);
    setError(null);
    const savePromise = (async () => {
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

      // Split coInstructorIds into already-accepted (write perms via updateCourse)
      // vs newly-added-to-invite (handled post-save via invite RPC + email).
      const pendingInviteIdSet = new Set(
        pendingCoInstructorInvites.map((i) => i.invitee_user_id),
      );
      const acceptedSet = new Set(acceptedCoInstructorIdsSnapshot);
      const writableAcceptedIds = coInstructorIds.filter((cid) =>
        acceptedSet.has(cid),
      );
      const idsToInvite = coInstructorIds.filter(
        (cid) =>
          cid &&
          cid !== course.instructor_id &&
          !acceptedSet.has(cid) &&
          !pendingInviteIdSet.has(cid),
      );

      const coInstructorSnapshots = (() => {
        if (!canEditCoInstructors) return undefined;
        const byId = new Map(instructorDirectory.map((p) => [p.id, p]));
        const fallbackById = new Map(
          (course.co_instructors ?? []).map((c) => [c.id, c]),
        );
        return writableAcceptedIds
          .filter((cid) => cid && cid !== course.instructor_id)
          .map((cid) => {
            const showOnPage = coInstructorVisibility[cid] !== false;
            const prof = byId.get(cid);
            const base = prof
              ? toCoInstructorSnapshot(prof)
              : (fallbackById.get(cid) ?? { id: cid, name: cid });
            return { ...base, show_on_course_page: showOnPage };
          });
      })();

      const coInstructorPermissionsPayload = (() => {
        if (!canEditCoInstructors) return undefined;
        const next: Record<string, CourseCoInstructorPermissions> = {};
        for (const cid of writableAcceptedIds) {
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
        is_external_aggregated: form.is_external_aggregated,
        external_source_urls: form.external_source_urls_text
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        external_source_attribution_note:
          form.external_source_attribution_note.trim() || null,
        is_updating: form.is_updating,
        has_certificate: form.has_certificate,
        has_sections: form.has_sections,
        i18n: i18nPayload,
        sponsors,
        partners,
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
              is_external_aggregated: form.is_external_aggregated,
              external_source_urls: form.external_source_urls_text
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
              external_source_attribution_note:
                form.external_source_attribution_note.trim() || null,
              is_updating: form.is_updating,
              has_certificate: form.has_certificate,
              i18n: i18nPayload,
              sponsors,
              partners,
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

      // After course save, fire co-instructor invites for newly-added uids.
      if (canEditCoInstructors && idsToInvite.length > 0) {
        let invitedCount = 0;
        let inviteFailures = 0;
        for (const inviteeId of idsToInvite) {
          try {
            await inviteCoInstructor({
              courseId: course.id,
              inviteeUserId: inviteeId,
              permissions: coInstructorPermissions[inviteeId] ?? {},
            });
            invitedCount += 1;
          } catch (err) {
            inviteFailures += 1;
            console.error("[co-instructor invite]", inviteeId, err);
          }
        }
        if (invitedCount > 0) {
          toast.success(
            t("courseEdit.coInstructors.inviteSent", { count: invitedCount }),
          );
        }
        if (inviteFailures > 0) {
          toast.error(
            t("courseEdit.coInstructors.inviteFailed", { count: inviteFailures }),
          );
        }
        // Remove invited uids from local state (they are not real co-instructors yet)
        // and reload pending invites from DB.
        const invitedSet = new Set(idsToInvite);
        setCoInstructorIds((prev) => prev.filter((id) => !invitedSet.has(id)));
        setCoInstructorPermissions((prev) => {
          const next = { ...prev };
          for (const id of invitedSet) delete next[id];
          return next;
        });
        try {
          const refreshed = await listPendingCoInstructorInvites(course.id);
          setPendingCoInstructorInvites(refreshed);
        } catch (err) {
          console.error("[co-instructor invite] refresh pending", err);
        }
      }
    })();

    try {
      await trackLoadingPromise(savePromise, "save-course-info");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeCoInstructorInvite = async (inviteId: string) => {
    if (!course?.id) return;
    try {
      await revokeCoInstructorInvite(inviteId);
      setPendingCoInstructorInvites((prev) =>
        prev.filter((i) => i.id !== inviteId),
      );
      toast.success(t("courseEdit.coInstructors.inviteRevoked"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "revoke_failed");
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

  const handleIssueCertificateForUser = async (userId: string) => {
    if (!id) return;
    setIssuingCertForUser(userId);
    try {
      const issued = await checkAndIssueCertificate(userId, id);
      if (issued) {
        setEnrollments((prev) =>
          prev.map((e) =>
            e.user_id === userId
              ? { ...e, certificate_issued_at: new Date().toISOString() }
              : e,
          ),
        );
        toast.success(t("courseEdit.toasts.certificateIssued"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.errors.processFailed"));
    } finally {
      setIssuingCertForUser(null);
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

  const persistSponsors = async (
    nextSponsors: CourseSponsor[],
    toastKey?: string,
  ) => {
    if (!id) return;
    setSponsors(nextSponsors);
    setCourse((prev) => (prev ? { ...prev, sponsors: nextSponsors } : prev));
    try {
      await updateCourse(id, { sponsors: nextSponsors });
      if (toastKey) toast.success(String(t(toastKey as never)));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : String(t("courseEdit.errors.updateFailed")),
      );
    }
  };

  const openAddSponsor = () => {
    const sid = createSponsorId();
    setActiveSponsorId(sid);
    setSponsorDialogLocale("vi");
    setSponsorForm({
      website: "",
      logo_url: "",
      logo_path: "",
      locale_content: { vi: { name: "", description: "" }, en: { name: "", description: "" } },
    });
    setSponsorDialogOpen(true);
  };

  const openEditSponsor = (s: CourseSponsor) => {
    setActiveSponsorId(String(s.id ?? "").trim() || null);
    setSponsorDialogLocale("vi");
    const lc = s.locale_content ?? {};
    setSponsorForm({
      website: String(s.website ?? ""),
      logo_url: String(s.logo_url ?? ""),
      logo_path: String(s.logo_path ?? ""),
      locale_content: {
        vi: { name: lc.vi?.name ?? s.name ?? "", description: lc.vi?.description ?? s.description ?? "" },
        en: { name: lc.en?.name ?? "", description: lc.en?.description ?? "" },
      },
    });
    setSponsorDialogOpen(true);
  };

  const handleSponsorLogoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const sid = String(activeSponsorId ?? "").trim();
    if (!sid) return;
    setUploadingSponsorLogo(true);
    try {
      const result = await uploadCourseSponsorLogo(
        id,
        sid,
        file,
        sponsorForm.logo_path,
      );
      setSponsorForm((p) => ({ ...p, logo_url: result.url, logo_path: result.path }));

      const nextSponsors = (() => {
        const normalized = sponsors.map((s) => ({ ...s, id: String(s.id ?? "").trim() }));
        const idx = normalized.findIndex((s) => s.id === sid);
        if (idx >= 0) {
          const updated = [...normalized];
          updated[idx] = { ...updated[idx], logo_url: result.url, logo_path: result.path };
          return updated;
        }
        const viName = sponsorForm.locale_content.vi.name.trim();
        const enName = sponsorForm.locale_content.en.name.trim();
        return [
          ...normalized,
          {
            id: sid,
            name: viName || enName || sid,
            website: sponsorForm.website.trim() || null,
            description: sponsorForm.locale_content.vi.description.trim() || sponsorForm.locale_content.en.description.trim() || null,
            logo_url: result.url,
            logo_path: result.path,
            locale_content: {
              vi: { name: viName, description: sponsorForm.locale_content.vi.description.trim() },
              en: { name: enName, description: sponsorForm.locale_content.en.description.trim() },
            },
          },
        ];
      })();

      await persistSponsors(nextSponsors, "courseEdit.sponsors.toasts.logoUploaded");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : String(t("courseEdit.sponsors.errors.uploadLogoFailed")),
      );
    } finally {
      setUploadingSponsorLogo(false);
      e.target.value = "";
    }
  };

  const saveSponsorFromDialog = async () => {
    const sid = String(activeSponsorId ?? "").trim();
    if (!sid) return;
    const viName = sponsorForm.locale_content.vi.name.trim();
    const enName = sponsorForm.locale_content.en.name.trim();
    const primaryName = viName || enName;
    if (!primaryName) {
      toast.error(String(t("courseEdit.sponsors.errors.missingName")));
      return;
    }
    const websiteValue = sponsorForm.website.trim();
    if (websiteValue && !isValidHttpUrl(websiteValue)) {
      toast.error(String(t("courseEdit.sponsors.errors.invalidWebsite")));
      return;
    }

    const localeContent: CourseSponsor["locale_content"] = {
      vi: { name: viName, description: sponsorForm.locale_content.vi.description.trim() },
      en: { name: enName, description: sponsorForm.locale_content.en.description.trim() },
    };

    const nextSponsors = (() => {
      const normalized = sponsors.map((s) => ({ ...s, id: String(s.id ?? "").trim() }));
      const idx = normalized.findIndex((s) => s.id === sid);
      const nextItem: CourseSponsor = {
        id: sid,
        name: primaryName,
        website: websiteValue || null,
        description: sponsorForm.locale_content.vi.description.trim() || sponsorForm.locale_content.en.description.trim() || null,
        logo_url: sponsorForm.logo_url.trim() || null,
        logo_path: sponsorForm.logo_path.trim() || null,
        locale_content: localeContent,
      };
      if (idx >= 0) {
        const updated = [...normalized];
        updated[idx] = { ...updated[idx], ...nextItem };
        return updated;
      }
      return [...normalized, nextItem];
    })();

    await persistSponsors(nextSponsors, "courseEdit.sponsors.toasts.saved");
    setSponsorDialogOpen(false);
  };

  const removeSponsor = async (s: CourseSponsor) => {
    const sid = String(s.id ?? "").trim();
    if (!sid) return;
    if (!confirm(String(t("courseEdit.sponsors.confirm.remove")))) return;
    const nextSponsors = sponsors.filter((x) => String(x.id ?? "").trim() !== sid);
    await persistSponsors(nextSponsors, "courseEdit.sponsors.toasts.removed");
    await deleteStorageObjectByPath(s.logo_path ?? null);
  };

  const persistPartners = async (nextPartners: CoursePartner[], toastKey?: string) => {
    if (!id) return;
    setPartners(nextPartners);
    setCourse((prev) => (prev ? { ...prev, partners: nextPartners } : prev));
    try {
      await updateCourse(id, { partners: nextPartners });
      if (toastKey) toast.success(String(t(toastKey as never)));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : String(t("courseEdit.errors.updateFailed")),
      );
    }
  };

  const openAddPartner = () => {
    const pid = createSponsorId();
    setActivePartnerId(pid);
    setPartnerDialogLocale("vi");
    setPartnerForm({
      website: "",
      logo_url: "",
      logo_path: "",
      locale_content: { vi: { name: "", description: "" }, en: { name: "", description: "" } },
    });
    setPartnerDialogOpen(true);
  };

  const openEditPartner = (p: CoursePartner) => {
    setActivePartnerId(String(p.id ?? "").trim() || null);
    setPartnerDialogLocale("vi");
    const lc = p.locale_content ?? {};
    setPartnerForm({
      website: String(p.website ?? ""),
      logo_url: String(p.logo_url ?? ""),
      logo_path: String(p.logo_path ?? ""),
      locale_content: {
        vi: { name: lc.vi?.name ?? p.name ?? "", description: lc.vi?.description ?? p.description ?? "" },
        en: { name: lc.en?.name ?? "", description: lc.en?.description ?? "" },
      },
    });
    setPartnerDialogOpen(true);
  };

  const handlePartnerLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const pid = String(activePartnerId ?? "").trim();
    if (!pid) return;
    setUploadingPartnerLogo(true);
    try {
      const result = await uploadCoursePartnerLogo(
        id,
        pid,
        file,
        partnerForm.logo_path,
      );
      setPartnerForm((p) => ({ ...p, logo_url: result.url, logo_path: result.path }));

      const nextPartners = (() => {
        const normalized = partners.map((p) => ({ ...p, id: String(p.id ?? "").trim() }));
        const idx = normalized.findIndex((p) => p.id === pid);
        if (idx >= 0) {
          const updated = [...normalized];
          updated[idx] = {
            ...updated[idx],
            logo_url: result.url,
            logo_path: result.path,
          };
          return updated;
        }
        const viName = partnerForm.locale_content.vi.name.trim();
        const enName = partnerForm.locale_content.en.name.trim();
        return [
          ...normalized,
          {
            id: pid,
            name: viName || enName || pid,
            website: partnerForm.website.trim() || null,
            description: partnerForm.locale_content.vi.description.trim() || partnerForm.locale_content.en.description.trim() || null,
            logo_url: result.url,
            logo_path: result.path,
            locale_content: {
              vi: { name: viName, description: partnerForm.locale_content.vi.description.trim() },
              en: { name: enName, description: partnerForm.locale_content.en.description.trim() },
            },
          },
        ];
      })();

      await persistPartners(nextPartners, "courseEdit.partners.toasts.logoUploaded");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : String(t("courseEdit.partners.errors.uploadLogoFailed")),
      );
    } finally {
      setUploadingPartnerLogo(false);
      e.target.value = "";
    }
  };

  const savePartnerFromDialog = async () => {
    const pid = String(activePartnerId ?? "").trim();
    if (!pid) return;
    const viName = partnerForm.locale_content.vi.name.trim();
    const enName = partnerForm.locale_content.en.name.trim();
    const primaryName = viName || enName;
    if (!primaryName) {
      toast.error(String(t("courseEdit.partners.errors.missingName")));
      return;
    }
    const websiteValue = partnerForm.website.trim();
    if (websiteValue && !isValidHttpUrl(websiteValue)) {
      toast.error(String(t("courseEdit.partners.errors.invalidWebsite")));
      return;
    }

    const localeContent: CoursePartner["locale_content"] = {
      vi: { name: viName, description: partnerForm.locale_content.vi.description.trim() },
      en: { name: enName, description: partnerForm.locale_content.en.description.trim() },
    };

    const nextPartners = (() => {
      const normalized = partners.map((p) => ({ ...p, id: String(p.id ?? "").trim() }));
      const idx = normalized.findIndex((p) => p.id === pid);
      const nextItem: CoursePartner = {
        id: pid,
        name: primaryName,
        website: websiteValue || null,
        description: partnerForm.locale_content.vi.description.trim() || partnerForm.locale_content.en.description.trim() || null,
        logo_url: partnerForm.logo_url.trim() || null,
        logo_path: partnerForm.logo_path.trim() || null,
        locale_content: localeContent,
      };
      if (idx >= 0) {
        const updated = [...normalized];
        updated[idx] = { ...updated[idx], ...nextItem };
        return updated;
      }
      return [...normalized, nextItem];
    })();

    await persistPartners(nextPartners, "courseEdit.partners.toasts.saved");
    setPartnerDialogOpen(false);
  };

  const removePartner = async (p: CoursePartner) => {
    const pid = String(p.id ?? "").trim();
    if (!pid) return;
    if (!confirm(String(t("courseEdit.partners.confirm.remove")))) return;
    const nextPartners = partners.filter((x) => String(x.id ?? "").trim() !== pid);
    await persistPartners(nextPartners, "courseEdit.partners.toasts.removed");
    await deleteStorageObjectByPath(p.logo_path ?? null);
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

  const handleGenerateCourseDescription = (
    targetField: "short_description" | "description",
  ) => {
    if (!id) return;
    const sourcePreviews = lessons.map((lesson) =>
      createSourcePreview({
        id: lesson.id,
        title: lesson.title,
        shortDescription: lesson.short_description,
        markdownDescription: lesson.description_markdown,
        youtubeUrl: lesson.youtube_url,
      }),
    );
    openDescriptionGenerator({
      title: t("courseEdit.descriptionGenerator.courseTitle"),
      description: t("courseEdit.descriptionGenerator.courseDescription"),
      type: "course",
      targetField,
      locale: activeContentLocale,
      sourcePreviews,
      warning: buildGeneratorWarning(sourcePreviews),
      requestBody: {
        type: "course",
        targetField,
        locale: activeContentLocale,
        courseId: id,
      },
      onApply: (value) =>
        setContentForm((prev) => ({
          ...prev,
          [targetField]: value,
        })),
    });
  };

  const handleGenerateSectionDescription = () => {
    if (!id || !editingSection) return;
    const sourcePreviews = lessons
      .filter((lesson) => lesson.section_id === editingSection.id)
      .map((lesson) =>
        createSourcePreview({
          id: lesson.id,
          title: lesson.title,
          shortDescription: lesson.short_description,
          markdownDescription: lesson.description_markdown,
          youtubeUrl: lesson.youtube_url,
        }),
      );
    openDescriptionGenerator({
      title: t("courseEdit.descriptionGenerator.sectionTitle"),
      description: t("courseEdit.descriptionGenerator.sectionDescription"),
      type: "course",
      targetField: "description",
      locale: dialogSectionLocale,
      sourcePreviews,
      warning: buildGeneratorWarning(sourcePreviews),
      requestBody: {
        type: "course",
        targetField: "description",
        locale: dialogSectionLocale,
        courseId: id,
        sectionId: editingSection.id,
      },
      onApply: (value) => setEditingSectionDescription(value),
    });
  };

  const handleGenerateLessonDescription = (params: {
    targetField: "short_description" | "description_markdown";
    lessonId?: string;
    youtubeUrl?: string;
    title: string;
    shortDescription?: string;
    markdownDescription?: string;
    sourceInputs?: DescriptionSourceInput[];
    sourcePreviews?: DescriptionGeneratorSourcePreview[];
    locale: SupportedCourseLocale;
    onApply: (value: string) => void;
  }) => {
    const sourcePreviews =
      params.sourcePreviews && params.sourcePreviews.length > 0
        ? params.sourcePreviews
        : [
            createSourcePreview({
              id: params.lessonId ?? "draft-lesson",
              title: params.title,
              shortDescription: params.shortDescription,
              markdownDescription: params.markdownDescription,
              youtubeUrl: params.youtubeUrl,
            }),
          ];
    openDescriptionGenerator({
      title: t("courseEdit.descriptionGenerator.lessonTitle"),
      description: t("courseEdit.descriptionGenerator.lessonDescription"),
      type: "lesson",
      targetField: params.targetField,
      locale: params.locale,
      sourcePreviews,
      warning: buildGeneratorWarning(sourcePreviews),
      requestBody: {
        type: "lesson",
        targetField: params.targetField,
        intent:
          params.targetField === "description_markdown" &&
          params.sourceInputs &&
          params.sourceInputs.length > 0
            ? "practice"
            : undefined,
        locale: params.locale,
        courseId: id ?? undefined,
        lessonId: params.lessonId,
        youtubeUrl: params.youtubeUrl?.trim() || undefined,
        lessonTitle: params.title?.trim() || undefined,
        sourceInputs: params.sourceInputs,
      },
      onApply: params.onApply,
    });
  };

  const handleGeneratePracticeTitle = (params: {
    sourceIds: Set<string>;
    fallbackTitle: string;
    locale: SupportedCourseLocale;
    onApply: (value: string) => void;
  }) => {
    const sourcePreviews = getLessonSourcePreviews(params.sourceIds);
    const sourceInputs = getLessonSourceInputs(params.sourceIds);
    openDescriptionGenerator({
      title: t("courseEdit.descriptionGenerator.lessonTitle"),
      description: t("courseEdit.descriptionGenerator.lessonDescription"),
      type: "lesson",
      targetField: "title",
      locale: params.locale,
      sourcePreviews,
      warning: buildGeneratorWarning(sourcePreviews),
      requestBody: {
        type: "lesson",
        targetField: "title",
        intent: "practice",
        locale: params.locale,
        courseId: id ?? undefined,
        lessonTitle: params.fallbackTitle,
        sourceInputs,
      },
      onApply: params.onApply,
    });
  };

  const handleTranslateCourseInfoBundle = () => {
    if (!course || activeContentLocale === primaryContentLocale) return;
    void translateBundle({
      busyKey: "course_info",
      bundleKind: "course_info",
      type: "course",
      targetLocale: activeContentLocale,
      sourceLocale: primaryContentLocale,
      courseId: id,
      sourceBundle: {
        title: course.title ?? "",
        shortDescription: course.short_description ?? "",
        description: course.description ?? "",
        learningOutcomes: course.learning_outcomes ?? [],
      },
      onApply: (bundle) =>
        setContentForm((prev) => ({
          ...prev,
          title: bundle.title ?? prev.title,
          short_description: bundle.shortDescription ?? prev.short_description,
          description: bundle.description ?? prev.description,
          learning_outcomes: bundle.learningOutcomes?.length
            ? bundle.learningOutcomes
            : prev.learning_outcomes,
        })),
    });
  };

  const handleTranslateLearningOutcomes = () => {
    if (!course || activeContentLocale === primaryContentLocale) return;
    void translateBundle({
      busyKey: "learning_outcomes",
      bundleKind: "course_info",
      type: "course",
      targetLocale: activeContentLocale,
      sourceLocale: primaryContentLocale,
      courseId: id,
      sourceBundle: {
        learningOutcomes: course.learning_outcomes ?? [],
      },
      onApply: (bundle) =>
        setContentForm((prev) => ({
          ...prev,
          learning_outcomes: bundle.learningOutcomes?.length
            ? bundle.learningOutcomes
            : prev.learning_outcomes,
        })),
    });
  };

  const handleTranslateAssignmentBundle = () => {
    if (!course || activeContentLocale === primaryContentLocale) return;
    void translateBundle({
      busyKey: "assignment",
      bundleKind: "assignment",
      type: "course",
      targetLocale: activeContentLocale,
      sourceLocale: primaryContentLocale,
      courseId: id,
      sourceBundle: {
        title: course.final_assignment_title ?? "",
        description: course.final_assignment_description ?? "",
        instructions: course.final_assignment_instructions ?? "",
      },
      onApply: (bundle) =>
        setContentForm((prev) => ({
          ...prev,
          final_assignment_title: bundle.title ?? prev.final_assignment_title,
          final_assignment_description:
            bundle.description ?? prev.final_assignment_description,
          final_assignment_instructions:
            bundle.instructions ?? prev.final_assignment_instructions,
        })),
    });
  };

  const handleTranslateSectionBundle = () => {
    if (!editingSection || dialogSectionLocale === primaryContentLocale) return;
    const sourceDraft = sectionDraftRef.current.get(primaryContentLocale) ?? {
      title: editingSection.title ?? "",
      description: editingSection.description ?? "",
    };
    void translateBundle({
      busyKey: "section",
      bundleKind: "section",
      type: "course",
      targetLocale: dialogSectionLocale,
      sourceLocale: primaryContentLocale,
      courseId: id,
      sectionId: editingSection.id,
      sourceBundle: {
        title: sourceDraft.title,
        description: sourceDraft.description,
      },
      onApply: (bundle) => {
        setEditingSectionTitle(bundle.title ?? editingSectionTitle);
        setEditingSectionDescription(bundle.description ?? editingSectionDescription);
      },
    });
  };

  const handleTranslateLessonBundle = () => {
    if (!editingLesson || dialogLessonLocale === primaryContentLocale) return;
    const sourceDraft =
      lessonDraftRef.current.get(primaryContentLocale) ?? captureLessonDraftFromState();
    void translateBundle({
      busyKey: "lesson",
      bundleKind: "lesson",
      type: "lesson",
      targetLocale: dialogLessonLocale,
      sourceLocale: primaryContentLocale,
      courseId: id,
      lessonId: editingLesson.id,
      sourceBundle: {
        title: sourceDraft.title,
        shortDescription: sourceDraft.shortDescription,
        markdownDescription: sourceDraft.markdown,
      },
      onApply: (bundle) => {
        setEditingLessonTitle(bundle.title ?? editingLessonTitle);
        setEditingLessonShortDescription(
          bundle.shortDescription ?? editingLessonShortDescription,
        );
        setEditingLessonMarkdown(bundle.markdownDescription ?? editingLessonMarkdown);
      },
    });
  };

  const handleAddLessonDirect = async () => {
    if (!id) return;
    try {
      const defaultSec = await getOrCreateDefaultSection(id);
      if (!sections.some((s) => s.id === defaultSec.id)) {
        setSections((prev) => [...prev, defaultSec]);
      }
      setAddingLessonDraftSectionId(defaultSec.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.prepareLessonFailed"));
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

  const openQuestionGenerator = (section: CourseSection) => {
    setQuestionGeneratorSection(section);
    setQuestionGeneratorOpen(true);
  };

  const openLessonQuizGenerator = (lesson: CourseLesson) => {
    setLessonQuizDialogLesson(lesson);
    setLessonQuizDialogOpen(true);
  };

  const hasQuizSourceContent = (lesson: CourseLesson) =>
    lesson.lesson_format !== "quiz" &&
    lesson.lesson_format !== "practice" &&
    Boolean(lesson.short_description?.trim() || lesson.description_markdown?.trim());

  const getPracticeSourceLessons = (
    sectionId: string | null | undefined,
    excludeLessonId?: string,
  ) =>
    lessons
      .filter(
        (lesson) =>
          lesson.section_id === sectionId &&
          lesson.id !== excludeLessonId &&
          hasQuizSourceContent(lesson),
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const getNewQuizSourceLessons = () =>
    getPracticeSourceLessons(addingLessonDraftSectionId);

  const getLessonSourceInputs = (sourceIds: Iterable<string>): DescriptionSourceInput[] => {
    const selected = new Set(sourceIds);
    return lessons
      .filter((lesson) => selected.has(lesson.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((lesson) =>
        createSourceInput({
          id: lesson.id,
          title: lesson.title,
          shortDescription: lesson.short_description,
          markdownDescription: lesson.description_markdown,
          youtubeUrl: lesson.youtube_url,
        }),
      );
  };

  const getLessonSourcePreviews = (
    sourceIds: Iterable<string>,
  ): DescriptionGeneratorSourcePreview[] => {
    const selected = new Set(sourceIds);
    return lessons
      .filter((lesson) => selected.has(lesson.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((lesson) =>
        createSourcePreview({
          id: lesson.id,
          title: lesson.title,
          shortDescription: lesson.short_description,
          markdownDescription: lesson.description_markdown,
          youtubeUrl: lesson.youtube_url,
        }),
      );
  };

  const getDefaultActivityLessonTitle = (
    sectionId: string,
    format: LessonFormat,
    accumulator?: CourseLesson[],
  ) =>
    getNextActivityLessonTitle(
      format,
      accumulator ?? lessons.filter((lesson) => lesson.section_id === sectionId),
    );

  const resetNewQuizGenerationState = () => {
    setNewQuizSourceLessonIds(new Set());
    setNewQuizGenerateError(null);
    setNewQuizGenerating(false);
    setNewQuizGeneratedSources([]);
  };

  const seedNewQuizSourceLessons = (sectionId: string | null) => {
    const sourceIds = getPracticeSourceLessons(sectionId).map((lesson) => lesson.id);
    setNewQuizSourceLessonIds(new Set(sourceIds));
  };

  const seedNewPracticeSourceLessons = (sectionId: string | null) => {
    const sourceIds = getPracticeSourceLessons(sectionId).map((lesson) => lesson.id);
    setNewPracticeSourceLessonIds(new Set(sourceIds));
    setNewPracticeSourceLessonId(sourceIds[0] ?? "");
  };

  const toggleNewQuizSourceLesson = (lessonId: string) => {
    setNewQuizSourceLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const toggleNewPracticeSourceLesson = (lessonId: string) => {
    setNewPracticeSourceLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      setNewPracticeSourceLessonId(Array.from(next)[0] ?? "");
      return next;
    });
  };

  const toggleEditingPracticeSourceLesson = (lessonId: string) => {
    setEditingPracticeSourceLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      setEditingPracticeSourceLessonId(Array.from(next)[0] ?? "");
      return next;
    });
  };

  const lessonQuizDialogSectionLessons = useMemo(
    () =>
      lessonQuizDialogLesson
        ? lessons
            .filter((l) => l.section_id === lessonQuizDialogLesson.section_id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((l) => ({
              id: l.id,
              title: l.title,
              hasSourceContent: hasQuizSourceContent(l),
            }))
        : [],
    [lessonQuizDialogLesson, lessons],
  );

  const handleGenerateNewQuizQuestions = async () => {
    if (!id || !addingLessonDraftSectionId || newQuizSourceLessonIds.size === 0) return;
    setNewQuizGenerating(true);
    setNewQuizGenerateError(null);
    try {
      const sourceLessonIds = Array.from(newQuizSourceLessonIds);
      const res = await invokeGenerateQuestions({
        courseId: id,
        // The quiz lesson does not exist yet, so we anchor generation on the first source lesson.
        lessonId: sourceLessonIds[0],
        sourceLessonIds,
        locale: activeContentLocale,
        count: newQuizQuestionCount,
      });
      setNewQuizGeneratedSources(res.sources);
      setNewQuizQuestions(res.questions.map(questionDataToNewQuizDraft));
    } catch (err) {
      setNewQuizGenerateError(
        err instanceof Error ? err.message : t("courseEdit.questions.generateFailed"),
      );
    } finally {
      setNewQuizGenerating(false);
    }
  };

  const openEditSection = (section: CourseSection) => {
    sectionDraftRef.current = new Map();
    const initLocale = activeContentLocale;
    setDialogSectionLocale(initLocale);
    setEditingSection(section);
    setEditingSectionTitle(section.title ?? "");
    setEditingSectionDescription(section.description ?? "");
    if (!id) return;
    // Pre-load all supported locales in the background
    for (const loc of supportedLocales) {
      if (loc === primaryContentLocale) {
        sectionDraftRef.current.set(loc, {
          title: section.title ?? "",
          description: section.description ?? "",
        });
      } else {
        void getCourseSectionLocaleContent(id, section.id, loc).catch(() => null).then((localized) => {
          if (!sectionDraftRef.current.has(loc)) {
            sectionDraftRef.current.set(loc, {
              title: localized?.title ?? section.title ?? "",
              description: localized?.description ?? section.description ?? "",
            });
          }
          if (loc === initLocale) {
            setEditingSectionTitle(localized?.title ?? section.title ?? "");
            setEditingSectionDescription(localized?.description ?? section.description ?? "");
          }
        });
      }
    }
  };

  const switchDialogSectionLocale = (nextLocale: SupportedCourseLocale) => {
    // Save current
    sectionDraftRef.current.set(dialogSectionLocale, {
      title: editingSectionTitle,
      description: editingSectionDescription,
    });
    // Load next
    const saved = sectionDraftRef.current.get(nextLocale);
    setEditingSectionTitle(saved?.title ?? editingSection?.title ?? "");
    setEditingSectionDescription(saved?.description ?? editingSection?.description ?? "");
    setDialogSectionLocale(nextLocale);
  };

  const handleSaveSectionDetails = async () => {
    if (!id || !editingSection) return;
    const savePromise = (async () => {
      // Flush current dialog locale into draft map before saving
      sectionDraftRef.current.set(dialogSectionLocale, {
        title: editingSectionTitle,
        description: editingSectionDescription,
      });

      // Save each locale that was touched
      for (const [loc, draft] of sectionDraftRef.current) {
        const title = draft.title.trim() || editingSection.title;
        const description = draft.description.trim() || undefined;
        if (loc === primaryContentLocale) {
          await updateSection(id, editingSection.id, { title, description });
          setSections((prev) =>
            prev.map((s) =>
              s.id === editingSection.id ? { ...s, title, description } : s,
            ),
          );
        } else {
          await setCourseSectionLocaleContent(id, editingSection.id, loc, { title, description });
          if (loc === activeContentLocale) {
            setSections((prev) =>
              prev.map((s) =>
                s.id === editingSection.id
                  ? applyCourseSectionLocaleContent(s, { locale: loc, title, description })
                  : s,
              ),
            );
            setSectionLocaleMap((prev) => {
              const next = new Map(prev);
              next.set(editingSection.id, { locale: loc, title, description });
              return next;
            });
          }
        }
      }
      setEditingSection(null);
    })();

    try {
      await trackLoadingPromise(savePromise, "save-section");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.updateFailed"));
    }
  };

  type PendingNewLessonSnap = {
    title: string;
    shortDescription: string;
    markdown: string;
    resources: Array<{ title: string; url: string }>;
    minutes: number | "";
    isPreviewFree: boolean;
    videoPrimaryLocale?: SupportedCourseLocale;
    hasSubtitle?: boolean;
    subtitleLocales?: SupportedCourseLocale[];
  };

  const insertLessonIntoCourse = async (
    sectionId: string,
    snap: PendingNewLessonSnap,
    opts: {
      youtubeUrl: string;
      title?: string;
      youtube_start_seconds?: number;
      youtube_end_seconds?: number | null;
      explicit_duration_seconds?: number;
      lessonAccumulator?: CourseLesson[];
      lessonFormat?: LessonFormat;
    },
  ): Promise<CourseLesson> => {
    if (!id) throw new Error(t("courseEdit.errors.addLessonFailed"));

    const lessonFormat = opts.lessonFormat ?? newLessonFormat;
    const isArticleFormat = lessonFormat === "article";
    const isPracticeFormat = lessonFormat === "practice";
    const isQuizFormat = lessonFormat === "quiz";
    const youtubeUrl = isArticleFormat || isPracticeFormat || isQuizFormat ? "" : opts.youtubeUrl.trim();
    const sanitizedResources = (snap.resources ?? [])
      .map((r) => ({ title: (r.title ?? "").trim(), url: (r.url ?? "").trim() }))
      .filter((r) => r.title && r.url);

    const fromApi = youtubeUrl ? await getYoutubeVideoDuration(youtubeUrl) : 0;
    const fromInput =
      snap.minutes !== "" && Number(snap.minutes) > 0 ? Number(snap.minutes) * 60 : 0;

    const durationSeconds =
      opts.explicit_duration_seconds != null
        ? opts.explicit_duration_seconds
        : fromInput > 0
          ? fromInput
          : fromApi;

    const ytStartRaw = opts.youtube_start_seconds;
    const ytStart =
      ytStartRaw != null && Number.isFinite(ytStartRaw) && ytStartRaw > 0
        ? Math.floor(ytStartRaw)
        : undefined;

    const ytEndRaw = opts.youtube_end_seconds;
    let ytEnd: number | undefined;
    if (
      ytEndRaw != null &&
      typeof ytEndRaw === "number" &&
      Number.isFinite(ytEndRaw)
    ) {
      const floored = Math.floor(ytEndRaw);
      if (floored > (ytStart ?? 0)) ytEnd = floored;
    }

    const secSubset =
      opts.lessonAccumulator ?? lessons.filter((l) => l.section_id === sectionId);

    const lessonTitle =
      (opts.title ?? snap.title).trim() ||
      getDefaultActivityLessonTitle(sectionId, lessonFormat, secSubset) ||
      t("courseEdit.defaults.lessonTitle");
    const practiceSourceId =
      Array.from(newPracticeSourceLessonIds)[0] || newPracticeSourceLessonId || undefined;

    const vidLocale = snap.videoPrimaryLocale ?? defaultVideoPrimaryLocale;
    const subOn = snap.hasSubtitle ?? false;
    const subLocales =
      subOn && (snap.subtitleLocales?.length ?? 0) > 0 ? snap.subtitleLocales! : [];

    const les = await addLesson(id, {
      section_id: sectionId,
      title: lessonTitle,
      lesson_format: lessonFormat,
      short_description: isQuizFormat || isPracticeFormat ? undefined : snap.shortDescription.trim() || undefined,
      youtube_url: youtubeUrl || undefined,
      youtube_start_seconds: isArticleFormat || isPracticeFormat || isQuizFormat ? undefined : ytStart,
      youtube_end_seconds: isArticleFormat || isPracticeFormat || isQuizFormat ? undefined : ytEnd,
      description_markdown: snap.markdown.trim() || undefined,
      resources: isQuizFormat || isPracticeFormat
        ? undefined
        : sanitizedResources.length
          ? sanitizedResources
          : undefined,
      practice_source_lesson_id: isPracticeFormat ? practiceSourceId : undefined,
      video_primary_locale: vidLocale,
      has_subtitle: subOn,
      subtitle_locales: subLocales,
      duration_seconds: isQuizFormat || isPracticeFormat ? 0 : Math.max(0, Math.floor(durationSeconds || 0)),
      order: getNextOrder(secSubset),
      is_preview_free:
        form.access_model === "paid_upfront" ? snap.isPreviewFree : false,
    });

    if (activeContentLocale !== primaryContentLocale) {
      await setCourseLessonLocaleContent(id, les.id, activeContentLocale, {
        title: lessonTitle,
        short_description: isQuizFormat || isPracticeFormat ? undefined : snap.shortDescription.trim() || undefined,
        youtube_url: youtubeUrl || undefined,
        description_markdown: snap.markdown.trim() || undefined,
        resources: isQuizFormat || isPracticeFormat
          ? undefined
          : sanitizedResources.length
            ? sanitizedResources
            : undefined,
        video_primary_locale: vidLocale,
        has_subtitle: subOn,
        subtitle_locales: subLocales,
      });
      setLessons((prev) => [
        ...prev,
        applyCourseLessonLocaleContent(les, {
          locale: activeContentLocale,
          title: lessonTitle,
          short_description: isQuizFormat || isPracticeFormat ? undefined : snap.shortDescription.trim() || undefined,
          youtube_url: youtubeUrl || undefined,
          description_markdown: snap.markdown.trim() || undefined,
          resources: isQuizFormat || isPracticeFormat
            ? undefined
            : sanitizedResources.length
              ? sanitizedResources
              : undefined,
          video_primary_locale: vidLocale,
          has_subtitle: subOn,
          subtitle_locales: subLocales,
        }),
      ]);
    } else {
      setLessons((prev) => [...prev, les]);
    }

    return les;
  };

  const executeReplaceLessonWithSegments = async (
    pv: NonNullable<typeof longVideoSplitPayload>,
    segments: LessonSegmentFromYoutube[],
    snap: PendingNewLessonSnap,
  ) => {
    const rc = pv.replaceContext;
    if (!id || !rc || segments.length === 0) return;

    const { replaceLessonId, orderedSectionLessonIds } = rc;
    const idx = orderedSectionLessonIds.indexOf(replaceLessonId);
    if (idx === -1) throw new Error(t("courseEdit.errors.reorderLessonsFailed"));

    const idsBefore = orderedSectionLessonIds.slice(0, idx);
    const idsAfter = orderedSectionLessonIds.slice(idx + 1);

    /** Insert new lessons first (keep the lesson being replaced until reorder + delete succeed). */
    let acc = (await getCourseLessons(id))
      .filter((l) => l.section_id === pv.sectionId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const createdIds: string[] = [];
    for (const seg of segments) {
      const ytEnd =
        seg.endSeconds >= pv.videoDurationSeconds ? undefined : seg.endSeconds;
      const les = await insertLessonIntoCourse(pv.sectionId, snap, {
        youtubeUrl: pv.youtubeUrl,
        title: seg.title,
        youtube_start_seconds: seg.startSeconds,
        youtube_end_seconds: ytEnd ?? undefined,
        explicit_duration_seconds: Math.max(1, seg.endSeconds - seg.startSeconds),
        lessonAccumulator: acc,
      });
      createdIds.push(les.id);
      acc = [...acc, les].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const mergedIds = [...idsBefore, ...createdIds, ...idsAfter];
    /** Place the old lesson last so sort_orders stay unique, then delete it. */
    const tempOrderIds = [...mergedIds, replaceLessonId];

    let allLessons = await getCourseLessons(id);
    let byId = new Map(allLessons.map((l) => [l.id, l]));

    const rebuiltTemp = tempOrderIds.map((lid, order) => {
      const l = byId.get(lid);
      if (!l) throw new Error(t("courseEdit.errors.reorderLessonsFailed"));
      return { id: l.id, order, section_id: pv.sectionId };
    });
    await reorderCourseLessons(id, rebuiltTemp);

    await deleteLesson(id, replaceLessonId);

    allLessons = await getCourseLessons(id);
    byId = new Map(allLessons.map((l) => [l.id, l]));

    const rebuiltFinal = mergedIds.map((lid, order) => {
      const l = byId.get(lid);
      if (!l) throw new Error(t("courseEdit.errors.reorderLessonsFailed"));
      return { id: l.id, order, section_id: pv.sectionId };
    });
    await reorderCourseLessons(id, rebuiltFinal);

    const freshLessons = await getCourseLessons(id);
    setLessons(freshLessons);
    await refreshCourseTotalDuration(id);
    const refreshedCourse = await getCourse(id);
    if (refreshedCourse) setCourse(refreshedCourse);
    void getLessonDistinctLearnerCountsForCourse(id)
      .then(setLessonLearnerCounts)
      .catch(() => {});
  };

  const finalizeReplaceKeepSingleLesson = async (
    pv: NonNullable<typeof longVideoSplitPayload>,
    lessonBeingEdited: CourseLesson,
  ) => {
    if (!id) return;

    const lessonId = lessonBeingEdited.id;
    const ytTrim = pv.youtubeUrl.trim();
    const fullDur = await getYoutubeVideoDuration(ytTrim);

    for (const [loc, draft] of lessonDraftRef.current) {
      const sanitizedResources = (draft.resources ?? [])
        .map((r) => ({ title: (r.title ?? "").trim(), url: (r.url ?? "").trim() }))
        .filter((r) => r.title && r.url);
      const payload = {
        title: draft.title.trim() || lessonBeingEdited.title,
        youtube_url: ytTrim || undefined,
        video_primary_locale: draft.videoPrimaryLocale,
        has_subtitle: draft.hasSubtitle,
        subtitle_locales: draft.hasSubtitle ? draft.subtitleLocales : [],
        short_description: draft.shortDescription.trim() || undefined,
        description_markdown: draft.markdown.trim() || undefined,
        resources: sanitizedResources.length ? sanitizedResources : undefined,
      };
      if (loc === primaryContentLocale) {
        await updateLesson(
          id,
          lessonId,
          {
            ...payload,
            ...(fullDur > 0
              ? { duration_seconds: Math.max(1, Math.floor(fullDur)) }
              : {}),
          },
          { clearYoutubeSegments: true },
        );
      } else {
        await setCourseLessonLocaleContent(id, lessonId, loc, payload);
      }
    }

    const freshLessons = await getCourseLessons(id);
    setLessons(freshLessons);
    await refreshCourseTotalDuration(id);
    const refreshedCourse = await getCourse(id);
    if (refreshedCourse) setCourse(refreshedCourse);
    void getLessonDistinctLearnerCountsForCourse(id)
      .then(setLessonLearnerCounts)
      .catch(() => {});
  };

  const resetNewLessonFormFields = () => {
    setNewLessonTitle("");
    setNewLessonShortDescription("");
    setNewLessonYoutubeUrl("");
    setNewLessonMinutes("");
    setNewLessonIsPreviewFree(false);
    setNewLessonMarkdown("");
    setNewLessonResources([]);
    setNewPracticeSourceLessonId("");
    setNewPracticeSourceLessonIds(new Set());
    setNewQuizQuestions([]);
    resetNewQuizGenerationState();
    setNewLessonFormat("video");
    setAddingLessonDraftSectionId(null);
    pendingNewLessonSnapRef.current = null;
  };

  const updateNewQuizQuestion = (
    index: number,
    updater: (question: NewQuizQuestionDraft) => NewQuizQuestionDraft,
  ) => {
    setNewQuizQuestions((prev) =>
      prev.map((question, i) => (i === index ? updater(question) : question)),
    );
  };

  const updateNewQuizQuestionOption = (
    questionIndex: number,
    optionIndex: number,
    text: string,
  ) => {
    updateNewQuizQuestion(questionIndex, (question) => ({
      ...question,
      options: question.options.map((option, i) =>
        i === optionIndex ? { ...option, text } : option,
      ) as QuestionOption[],
    }));
  };

  const serializeNewQuizQuestions = (): SectionQuestionData[] => {
    return newQuizQuestions
      .map((question) => ({
        type: "mcq" as const,
        question: question.question.trim(),
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text.trim(),
        })),
        correct_index: question.correct_index,
        explanation: question.explanation?.trim() || undefined,
        locale: activeContentLocale,
      }))
      .filter(
        (question) =>
          question.question ||
          question.options.some((option) => option.text),
      );
  };

  const handleCancelLongVideoSplit = () => {
    if (suppressLongVideoDismissRestoreRef.current) {
      suppressLongVideoDismissRestoreRef.current = false;
      setLongVideoSplitUiMode("choose");
      setManualSegmentRows([{ start: "0:00", end: "", title: "" }]);
      return;
    }
    const payload = longVideoSplitPayload;
    const snap = pendingNewLessonSnapRef.current;
    setLongVideoSplitOpen(false);
    setLongVideoSplitPayload(null);
    setLongVideoSplitUiMode("choose");
    setManualSegmentRows([{ start: "0:00", end: "", title: "" }]);
    if (payload && snap && !payload.replaceContext) {
      setAddingLessonDraftSectionId(payload.sectionId);
      setNewLessonTitle(snap.title);
      setNewLessonShortDescription(snap.shortDescription);
      setNewLessonYoutubeUrl(payload.youtubeUrl);
      setNewLessonMarkdown(snap.markdown);
      setNewLessonResources(snap.resources);
      setNewLessonMinutes(snap.minutes);
      setNewLessonIsPreviewFree(snap.isPreviewFree);
    }
  };

  const handleConfirmLongVideoKeepSingle = async () => {
    const pv = longVideoSplitPayload;
    const snap = pendingNewLessonSnapRef.current;
    if (!pv || !snap || !id) return;

    if (pv.replaceContext && editingLesson?.id === pv.replaceContext.replaceLessonId) {
      setAddingLessonInProgress(true);
      try {
        await finalizeReplaceKeepSingleLesson(pv, editingLesson);
        suppressLongVideoDismissRestoreRef.current = true;
        resetNewLessonFormFields();
        setLongVideoSplitPayload(null);
        setLongVideoSplitOpen(false);
        setEditingLesson(null);
        lessonDraftRef.current = new Map();
        toast.success(t("courseEdit.toasts.saved"));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : t("courseEdit.errors.updateFailed"),
        );
      } finally {
        setAddingLessonInProgress(false);
      }
      return;
    }

    setAddingLessonInProgress(true);
    try {
      const acc = lessons.filter((l) => l.section_id === pv.sectionId);
      await insertLessonIntoCourse(pv.sectionId, snap, {
        youtubeUrl: pv.youtubeUrl,
        lessonAccumulator: acc,
      });
      suppressLongVideoDismissRestoreRef.current = true;
      resetNewLessonFormFields();
      setLongVideoSplitPayload(null);
      setLongVideoSplitOpen(false);
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.addLessonFailed"));
    } finally {
      setAddingLessonInProgress(false);
    }
  };

  const handleConfirmLongVideoAutoSplit = async () => {
    const pv = longVideoSplitPayload;
    const snap = pendingNewLessonSnapRef.current;
    if (!pv || !snap || !id || pv.autoSegments.length < 2) return;

    if (pv.replaceContext && editingLesson?.id === pv.replaceContext.replaceLessonId) {
      setAddingLessonInProgress(true);
      try {
        await executeReplaceLessonWithSegments(pv, pv.autoSegments, snap);
        suppressLongVideoDismissRestoreRef.current = true;
        resetNewLessonFormFields();
        setLongVideoSplitPayload(null);
        setLongVideoSplitOpen(false);
        setEditingLesson(null);
        lessonDraftRef.current = new Map();
        toast.success(t("courseEdit.toasts.saved"));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : t("courseEdit.errors.addLessonFailed"),
        );
      } finally {
        setAddingLessonInProgress(false);
      }
      return;
    }

    setAddingLessonInProgress(true);
    try {
      let acc = lessons.filter((l) => l.section_id === pv.sectionId);
      for (const seg of pv.autoSegments) {
        const ytEnd =
          seg.endSeconds >= pv.videoDurationSeconds ? undefined : seg.endSeconds;
        const les = await insertLessonIntoCourse(pv.sectionId, snap, {
          youtubeUrl: pv.youtubeUrl,
          title: seg.title,
          youtube_start_seconds: seg.startSeconds,
          youtube_end_seconds: ytEnd ?? undefined,
          explicit_duration_seconds: Math.max(1, seg.endSeconds - seg.startSeconds),
          lessonAccumulator: acc,
        });
        acc = [...acc, les];
      }
      suppressLongVideoDismissRestoreRef.current = true;
      resetNewLessonFormFields();
      setLongVideoSplitPayload(null);
      setLongVideoSplitOpen(false);
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.addLessonFailed"));
    } finally {
      setAddingLessonInProgress(false);
    }
  };

  const handleConfirmLongVideoManualSplit = async () => {
    const pv = longVideoSplitPayload;
    const snap = pendingNewLessonSnapRef.current;
    if (!pv || !snap || !id) return;

    const videoDur = pv.videoDurationSeconds;
    const parsedRows: Array<{ title: string; start: number; end: number | null }> = [];
    for (const row of manualSegmentRows) {
      const start = parseTimestampLabelToSeconds(row.start.trim());
      const title = row.title.trim() || t("courseEdit.defaults.lessonTitle");
      if (start == null) {
        toast.error(t("courseEdit.longVideo.manual.invalidTimestamp"));
        return;
      }
      let end: number | null = null;
      if (row.end.trim()) {
        end = parseTimestampLabelToSeconds(row.end.trim());
        if (end == null || end <= start) {
          toast.error(t("courseEdit.longVideo.manual.invalidEnd"));
          return;
        }
      }
      parsedRows.push({ title, start, end });
    }

    parsedRows.sort((a, b) => a.start - b.start);

    const built: LessonSegmentFromYoutube[] = [];
    let prevEndBoundary = 0;
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (row.start < prevEndBoundary) {
        toast.error(t("courseEdit.longVideo.manual.overlap"));
        return;
      }
      const nextStart = i + 1 < parsedRows.length ? parsedRows[i + 1].start : videoDur;
      const endSec =
        row.end != null ? Math.min(row.end, nextStart, videoDur) : Math.min(nextStart, videoDur);
      if (!(endSec > row.start)) {
        toast.error(t("courseEdit.longVideo.manual.invalidRange"));
        return;
      }
      built.push({
        title: row.title,
        startSeconds: row.start,
        endSeconds: endSec,
      });
      prevEndBoundary = endSec;
    }

    if (built.length === 0) {
      toast.error(t("courseEdit.longVideo.manual.needRow"));
      return;
    }

    setAddingLessonInProgress(true);
    try {
      if (pv.replaceContext && editingLesson?.id === pv.replaceContext.replaceLessonId) {
        await executeReplaceLessonWithSegments(pv, built, snap);
        suppressLongVideoDismissRestoreRef.current = true;
        resetNewLessonFormFields();
        setLongVideoSplitPayload(null);
        setManualSegmentRows([{ start: "0:00", end: "", title: "" }]);
        setLongVideoSplitOpen(false);
        setEditingLesson(null);
        lessonDraftRef.current = new Map();
        toast.success(t("courseEdit.toasts.saved"));
        return;
      }

      let acc = lessons.filter((l) => l.section_id === pv.sectionId);
      for (const seg of built) {
        const ytEnd =
          seg.endSeconds >= pv.videoDurationSeconds ? undefined : seg.endSeconds;
        const les = await insertLessonIntoCourse(pv.sectionId, snap, {
          youtubeUrl: pv.youtubeUrl,
          title: seg.title,
          youtube_start_seconds: seg.startSeconds,
          youtube_end_seconds: ytEnd ?? undefined,
          explicit_duration_seconds: Math.max(1, seg.endSeconds - seg.startSeconds),
          lessonAccumulator: acc,
        });
        acc = [...acc, les];
      }
      suppressLongVideoDismissRestoreRef.current = true;
      resetNewLessonFormFields();
      setLongVideoSplitPayload(null);
      setManualSegmentRows([{ start: "0:00", end: "", title: "" }]);
      setLongVideoSplitOpen(false);
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.addLessonFailed"));
    } finally {
      setAddingLessonInProgress(false);
    }
  };

  const handleAddLesson = async (sectionId: string) => {
    if (!id) return;

    const snap: PendingNewLessonSnap = {
      title: newLessonTitle,
      shortDescription:
        newLessonFormat === "quiz" || newLessonFormat === "practice"
          ? ""
          : newLessonShortDescription,
      markdown: newLessonFormat === "quiz" ? "" : newLessonMarkdown,
      resources:
        newLessonFormat === "quiz" || newLessonFormat === "practice"
          ? []
          : [...newLessonResources],
      minutes:
        newLessonFormat === "quiz" || newLessonFormat === "practice"
          ? ""
          : newLessonMinutes,
      isPreviewFree: newLessonIsPreviewFree,
    };
    pendingNewLessonSnapRef.current = snap;

    const isArticleFormat = newLessonFormat === "article";
    const isPracticeFormat = newLessonFormat === "practice";
    const isNonVideoNewFormat = newLessonFormat !== "video";
    if (isArticleFormat && !newLessonMarkdown.trim() && !newLessonShortDescription.trim()) {
      toast.error(t("courseEdit.lessons.articleContentRequired"));
      return;
    }
    if (isPracticeFormat && !newLessonMarkdown.trim()) {
      toast.error(t("courseEdit.lessons.practiceContentRequired"));
      return;
    }
    const quizQuestionPayload =
      newLessonFormat === "quiz" ? serializeNewQuizQuestions() : [];
    if (newLessonFormat === "quiz") {
      const invalid = quizQuestionPayload.find(
        (question) =>
          !question.question ||
          question.options.filter((option) => option.text).length < 2,
      );
      if (invalid) {
        toast.error(t("courseEdit.questions.fillRequired"));
        return;
      }
    }

    const youtubeUrl = isNonVideoNewFormat ? "" : newLessonYoutubeUrl.trim();

    setAddingLessonInProgress(true);
    try {
      const fromInput =
        newLessonMinutes !== "" && Number(newLessonMinutes) > 0
          ? Number(newLessonMinutes) * 60
          : 0;

      const meta = youtubeUrl ? await fetchYoutubeVideoMetadata(youtubeUrl) : null;
      const fromApi = meta?.durationSeconds ?? (youtubeUrl ? await getYoutubeVideoDuration(youtubeUrl) : 0);

      const durationGuess = fromInput > 0 ? fromInput : fromApi;

      if (!isNonVideoNewFormat && youtubeUrl && durationGuess > LONG_VIDEO_SPLIT_SECONDS) {
        const videoDur = meta?.durationSeconds ?? durationGuess;
        const description = meta?.description ?? "";
        const chapterStarts = parseChaptersFromDescription(description, videoDur);
        const autoSegments =
          chapterStarts.length >= 2
            ? buildSegmentsFromChapterStarts(chapterStarts, videoDur)
            : [];

        setLongVideoSplitPayload({
          sectionId,
          youtubeUrl,
          videoDurationSeconds: videoDur,
          chapterStarts,
          autoSegments,
        });
        setLongVideoSplitUiMode(autoSegments.length >= 2 ? "choose" : "manual");
        setManualSegmentRows([
          {
            start: "0:00",
            end: formatSecondsToTimestamp(videoDur),
            title: "",
          },
        ]);
        setLongVideoSplitOpen(true);
        setAddingLessonDraftSectionId(null);
        return;
      }

      const secSubset = lessons.filter((l) => l.section_id === sectionId);
      const createdLesson = await insertLessonIntoCourse(sectionId, snap, {
        youtubeUrl,
        lessonFormat: newLessonFormat,
        lessonAccumulator: secSubset,
      });
      resetNewLessonFormFields();
      if (newLessonFormat === "quiz") {
        if (quizQuestionPayload.length > 0) {
          await setLessonQuestions(id, createdLesson.id, quizQuestionPayload);
        } else {
          openLessonQuizGenerator(createdLesson);
        }
      }
      await refreshCourseTotalDuration(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.errors.addLessonFailed"));
    } finally {
      setAddingLessonInProgress(false);
    }
  };

  const applyLessonDraftToState = (draft: LessonDraft) => {
    setEditingLessonTitle(draft.title);
    setEditingLessonYoutubeUrl(draft.youtubeUrl);
    setEditingLessonVideoPrimaryLocale(draft.videoPrimaryLocale);
    setEditingLessonHasSubtitle(draft.hasSubtitle);
    setEditingLessonSubtitleLocales(draft.subtitleLocales);
    setEditingLessonShortDescription(draft.shortDescription);
    setEditingLessonMarkdown(draft.markdown);
    setEditingLessonResources(draft.resources);
    setEditingPracticeSourceLessonId(draft.practiceSourceLessonId);
    setEditingPracticeSourceLessonIds(new Set(draft.practiceSourceLessonIds));
  };

  const captureLessonDraftFromState = (): LessonDraft => ({
    title: editingLessonTitle,
    youtubeUrl: editingLessonYoutubeUrl,
    videoPrimaryLocale: editingLessonVideoPrimaryLocale,
    hasSubtitle: editingLessonHasSubtitle,
    subtitleLocales: editingLessonSubtitleLocales,
    shortDescription: editingLessonShortDescription,
    markdown: editingLessonMarkdown,
    resources: editingLessonResources,
    practiceSourceLessonId: editingPracticeSourceLessonId,
    practiceSourceLessonIds: Array.from(editingPracticeSourceLessonIds),
  });

  const lessonToDraft = (lesson: CourseLesson): LessonDraft => ({
    title: lesson.title ?? "",
    youtubeUrl: lesson.youtube_url ?? "",
    videoPrimaryLocale: normalizeCourseLocale(lesson.video_primary_locale ?? defaultVideoPrimaryLocale),
    hasSubtitle: lesson.has_subtitle ?? false,
    subtitleLocales: (lesson.subtitle_locales ?? []).map(normalizeCourseLocale),
    shortDescription: lesson.short_description ?? "",
    markdown: lesson.description_markdown ?? "",
    resources: (lesson.resources ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "" })),
    practiceSourceLessonId: lesson.practice_source_lesson_id ?? "",
    practiceSourceLessonIds: lesson.practice_source_lesson_id ? [lesson.practice_source_lesson_id] : [],
  });

  const openEditLesson = (lesson: CourseLesson) => {
    lessonDraftRef.current = new Map();
    const initLocale = activeContentLocale;
    setDialogLessonLocale(initLocale);
    // Primary locale uses the lesson data directly
    lessonDraftRef.current.set(primaryContentLocale, lessonToDraft(lesson));
    setEditingLesson(lesson);
    setEditingLessonFormat(getLessonFormat(lesson));
    setEditingLessonMinutes(
      lesson.duration_seconds > 0 ? Math.ceil(lesson.duration_seconds / 60) : "",
    );
    applyLessonDraftToState(lessonToDraft(lesson));
    setEditingLessonYoutubeStartLabel(
      formatSecondsToTimestamp(lesson.youtube_start_seconds ?? 0),
    );
    const ys = lesson.youtube_start_seconds ?? 0;
    const ye = lesson.youtube_end_seconds;
    setEditingLessonYoutubeEndLabel(
      ye != null && ye > ys ? formatSecondsToTimestamp(ye) : "",
    );
    if (!id) return;
    // Pre-load non-primary locales in background
    for (const loc of supportedLocales) {
      if (loc === primaryContentLocale) continue;
      void getCourseLessonLocaleContent(id, lesson.id, loc).catch(() => null).then((localized) => {
        const draft: LessonDraft = {
          title: localized?.title ?? lesson.title ?? "",
          youtubeUrl: localized?.youtube_url ?? lesson.youtube_url ?? "",
          videoPrimaryLocale: normalizeCourseLocale(localized?.video_primary_locale ?? lesson.video_primary_locale ?? defaultVideoPrimaryLocale),
          hasSubtitle: localized?.has_subtitle ?? lesson.has_subtitle ?? false,
          subtitleLocales: (localized?.subtitle_locales ?? lesson.subtitle_locales ?? []).map(normalizeCourseLocale),
          shortDescription: localized?.short_description ?? lesson.short_description ?? "",
          markdown: localized?.description_markdown ?? lesson.description_markdown ?? "",
          resources: (localized?.resources ?? lesson.resources ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "" })),
          practiceSourceLessonId: lesson.practice_source_lesson_id ?? "",
          practiceSourceLessonIds: lesson.practice_source_lesson_id ? [lesson.practice_source_lesson_id] : [],
        };
        if (!lessonDraftRef.current.has(loc)) {
          lessonDraftRef.current.set(loc, draft);
        }
        if (loc === initLocale) {
          applyLessonDraftToState(draft);
          setEditingLessonYoutubeStartLabel(
            formatSecondsToTimestamp(lesson.youtube_start_seconds ?? 0),
          );
          const ys0 = lesson.youtube_start_seconds ?? 0;
          const ye0 = lesson.youtube_end_seconds;
          setEditingLessonYoutubeEndLabel(
            ye0 != null && ye0 > ys0 ? formatSecondsToTimestamp(ye0) : "",
          );
        }
      });
    }
  };

  const switchDialogLessonLocale = (nextLocale: SupportedCourseLocale) => {
    lessonDraftRef.current.set(dialogLessonLocale, captureLessonDraftFromState());
    const saved = lessonDraftRef.current.get(nextLocale);
    if (saved) {
      applyLessonDraftToState(saved);
    }
    setDialogLessonLocale(nextLocale);
  };

  const handleSaveLessonDetails = async () => {
    if (!id || !editingLesson) return;
    const savePromise = (async () => {
      // Flush current dialog state into draft map
      lessonDraftRef.current.set(dialogLessonLocale, captureLessonDraftFromState());

      const primaryDraft =
        lessonDraftRef.current.get(primaryContentLocale) ?? captureLessonDraftFromState();
      const isArticleFormat = editingLessonFormat === "article";
      const isPracticeFormat = editingLessonFormat === "practice";
      const isQuizFormat = editingLessonFormat === "quiz";
      const isNonVideoFormat = editingLessonFormat !== "video";
      if (isArticleFormat) {
        if (!primaryDraft.markdown.trim() && !primaryDraft.shortDescription.trim()) {
          toast.error(t("courseEdit.lessons.articleContentRequired"));
          return;
        }
      }
      if (isPracticeFormat) {
        if (!primaryDraft.markdown.trim()) {
          toast.error(t("courseEdit.lessons.practiceContentRequired"));
          return;
        }
      }

      const ytUrlTrimmedMaster = isNonVideoFormat ? "" : editingLessonYoutubeUrl.trim();
      const learnerCount = lessonLearnerCounts[editingLesson.id] ?? 0;
      if (!isNonVideoFormat && learnerCount > 0) {
        const prevId = getYoutubeVideoId(editingLesson.youtube_url ?? "");
        const nextId = getYoutubeVideoId(ytUrlTrimmedMaster);
        if (prevId && nextId && prevId !== nextId) {
          toast.error(t("courseEdit.lessons.cannotChangeVideoWithProgress"));
          return;
        }
      }

      const prevVid = getYoutubeVideoId(editingLesson.youtube_url ?? "");
      const nextVid = getYoutubeVideoId(ytUrlTrimmedMaster);
      if (
        !isNonVideoFormat &&
        learnerCount === 0 &&
        ytUrlTrimmedMaster &&
        nextVid &&
        prevVid !== nextVid
      ) {
        const meta = await fetchYoutubeVideoMetadata(ytUrlTrimmedMaster);
        const fromApi =
          meta?.durationSeconds ??
          (await getYoutubeVideoDuration(ytUrlTrimmedMaster));
        const durationGuess = fromApi;

        if (durationGuess > LONG_VIDEO_SPLIT_SECONDS) {
          const primaryDraft =
            lessonDraftRef.current.get(primaryContentLocale) ??
            captureLessonDraftFromState();

          pendingNewLessonSnapRef.current = {
            title: primaryDraft.title,
            shortDescription: primaryDraft.shortDescription,
            markdown: primaryDraft.markdown,
            resources: [...primaryDraft.resources],
            minutes: "",
            isPreviewFree: !!editingLesson.is_preview_free,
            videoPrimaryLocale: primaryDraft.videoPrimaryLocale,
            hasSubtitle: primaryDraft.hasSubtitle,
            subtitleLocales: [...primaryDraft.subtitleLocales],
          };

          const videoDur = meta?.durationSeconds ?? durationGuess;
          const description = meta?.description ?? "";
          const chapterStarts = parseChaptersFromDescription(description, videoDur);
          const autoSegments =
            chapterStarts.length >= 2
              ? buildSegmentsFromChapterStarts(chapterStarts, videoDur)
              : [];

          const secSorted = lessons
            .filter((l) => l.section_id === editingLesson.section_id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          setLongVideoSplitPayload({
            sectionId: editingLesson.section_id,
            youtubeUrl: ytUrlTrimmedMaster,
            videoDurationSeconds: videoDur,
            chapterStarts,
            autoSegments,
            replaceContext: {
              replaceLessonId: editingLesson.id,
              orderedSectionLessonIds: secSorted.map((l) => l.id),
            },
          });
          setLongVideoSplitUiMode(autoSegments.length >= 2 ? "choose" : "manual");
          setManualSegmentRows([
            {
              start: "0:00",
              end: formatSecondsToTimestamp(videoDur),
              title: "",
            },
          ]);
          setLongVideoSplitOpen(true);
          return;
        }
      }

      let youtube_start_seconds: number | undefined;
      let youtube_end_seconds: number | null | undefined;
      if (!isNonVideoFormat && ytUrlTrimmedMaster) {
        const startParsed =
          parseTimestampLabelToSeconds(editingLessonYoutubeStartLabel.trim()) ?? 0;
        youtube_start_seconds = startParsed > 0 ? startParsed : undefined;
        if (editingLessonYoutubeEndLabel.trim()) {
          const endParsed = parseTimestampLabelToSeconds(
            editingLessonYoutubeEndLabel.trim(),
          );
          if (endParsed == null || endParsed <= startParsed) {
            toast.error(t("courseEdit.lessons.segmentEndInvalid"));
            return;
          }
          youtube_end_seconds = endParsed;
        } else {
          youtube_end_seconds = null;
        }
      }

      let segmentDurationSeconds: number | undefined;
      if (!isNonVideoFormat && ytUrlTrimmedMaster) {
        const effectiveStart = youtube_start_seconds ?? 0;
        if (
          youtube_end_seconds != null &&
          typeof youtube_end_seconds === "number"
        ) {
          segmentDurationSeconds = Math.max(
            0,
            Math.floor(youtube_end_seconds - effectiveStart),
          );
        } else {
          const vidDur = await getYoutubeVideoDuration(ytUrlTrimmedMaster);
          if (vidDur > 0) {
            segmentDurationSeconds = Math.max(
              0,
              Math.floor(vidDur - effectiveStart),
            );
          }
        }
      }

      const segmentPrimaryPatch =
        !isNonVideoFormat && ytUrlTrimmedMaster
          ? {
              youtube_start_seconds,
              youtube_end_seconds:
                youtube_end_seconds === undefined ? undefined : youtube_end_seconds,
              ...(segmentDurationSeconds != null && segmentDurationSeconds > 0
                ? { duration_seconds: Math.max(1, segmentDurationSeconds) }
                : {}),
            }
          : {};
      const nonVideoDurationPatch =
        isQuizFormat || isPracticeFormat
          ? { duration_seconds: 0 }
          : isNonVideoFormat && editingLessonMinutes !== "" && Number(editingLessonMinutes) > 0
          ? { duration_seconds: Math.max(0, Math.floor(Number(editingLessonMinutes) * 60)) }
          : {};

      for (const [loc, draft] of lessonDraftRef.current) {
        const sanitizedResources = (draft.resources ?? [])
          .map((r) => ({ title: (r.title ?? "").trim(), url: (r.url ?? "").trim() }))
          .filter((r) => r.title && r.url);
        const payload = {
          title: draft.title.trim() || editingLesson.title,
          youtube_url: isNonVideoFormat ? undefined : draft.youtubeUrl.trim() || undefined,
          video_primary_locale: draft.videoPrimaryLocale,
          has_subtitle: isNonVideoFormat ? false : draft.hasSubtitle,
          subtitle_locales:
            isNonVideoFormat || !draft.hasSubtitle ? [] : draft.subtitleLocales,
          short_description: isQuizFormat || isPracticeFormat ? "" : draft.shortDescription.trim() || undefined,
          description_markdown: isQuizFormat ? "" : draft.markdown.trim() || undefined,
          resources: isQuizFormat || isPracticeFormat
            ? []
            : sanitizedResources.length
              ? sanitizedResources
              : undefined,
          practice_source_lesson_id: isPracticeFormat
            ? draft.practiceSourceLessonIds[0] || draft.practiceSourceLessonId || undefined
            : undefined,
        };
        if (loc === primaryContentLocale) {
          const merged = {
            ...payload,
            lesson_format: editingLessonFormat,
            ...segmentPrimaryPatch,
            ...nonVideoDurationPatch,
          };
          await updateLesson(id, editingLesson.id, merged, {
            clearYoutube: isNonVideoFormat,
            clearYoutubeSegments: Boolean(!isNonVideoFormat && ytUrlTrimmedMaster),
          });
          setLessons((prev) =>
            prev.map((l) => (l.id === editingLesson.id ? { ...l, ...merged } : l)),
          );
        } else {
          await setCourseLessonLocaleContent(id, editingLesson.id, loc, payload);
          if (loc === activeContentLocale) {
            setLessons((prev) =>
              prev.map((l) =>
                l.id === editingLesson.id
                  ? applyCourseLessonLocaleContent(l, { locale: loc, ...payload })
                  : l,
              ),
            );
            setLessonLocaleMap((prev) => {
              const next = new Map(prev);
              next.set(editingLesson.id, { locale: loc, ...payload });
              return next;
            });
          }
        }
      }
      await refreshCourseTotalDuration(id);
      const refreshedCourse = await getCourse(id);
      if (refreshedCourse) setCourse(refreshedCourse);
      void getLessonDistinctLearnerCountsForCourse(id)
        .then(setLessonLearnerCounts)
        .catch(() => {});
      setEditingLesson(null);
    })();

    try {
      await trackLoadingPromise(savePromise, "save-lesson");
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

  const clearSectionDragState = () => {
    setDraggingSectionId(null);
    setSectionDropTarget(null);
  };

  const buildReorderedSections = (
    sourceSectionId: string,
    targetSectionId: string,
    targetPosition: SectionDropPosition,
  ) => {
    if (sourceSectionId === targetSectionId) return null;

    const sourceIndex = orderedSections.findIndex((s) => s.id === sourceSectionId);
    const targetIndex = orderedSections.findIndex((s) => s.id === targetSectionId);
    if (sourceIndex === -1 || targetIndex === -1) return null;

    const nextSections = [...orderedSections];
    const [movedSection] = nextSections.splice(sourceIndex, 1);
    if (!movedSection) return null;

    let insertIndex = targetIndex;
    if (sourceIndex < targetIndex) insertIndex -= 1;
    if (targetPosition === "after") insertIndex += 1;
    insertIndex = Math.max(0, Math.min(insertIndex, nextSections.length));

    nextSections.splice(insertIndex, 0, movedSection);
    const unchanged = nextSections.every(
      (section, index) => section.id === orderedSections[index]?.id,
    );
    if (unchanged) return null;

    return nextSections.map((section, index) => ({
      ...section,
      order: index,
    }));
  };

  const commitSectionOrder = async (nextOrderedSections: CourseSection[]) => {
    if (!id || nextOrderedSections.length === 0) return;

    const previousSections = sections;
    const reorderedById = new Map(
      nextOrderedSections.map((section) => [section.id, section]),
    );
    const nextSections = previousSections.map(
      (section) => reorderedById.get(section.id) ?? section,
    );

    setReorderingSections(true);
    setSections(nextSections);
    clearSectionDragState();

    try {
      await reorderCourseSections(
        id,
        nextOrderedSections.map(({ id: sectionId, order }) => ({
          id: sectionId,
          order,
        })),
      );
    } catch (e) {
      setSections(previousSections);
      const message =
        e instanceof Error
          ? e.message
          : t("courseEdit.errors.reorderSectionsFailed");
      setError(message);
      toast.error(message);
    } finally {
      setReorderingSections(false);
    }
  };

  const getSectionDropPosition = (
    event: React.DragEvent<HTMLElement>,
  ): SectionDropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top >= rect.height / 2 ? "after" : "before";
  };

  const handleMoveSection = async (
    sectionId: string,
    direction: -1 | 1,
  ) => {
    if (reorderingSections) return;

    const currentIndex = orderedSections.findIndex((s) => s.id === sectionId);
    const targetSection = orderedSections[currentIndex + direction];
    if (currentIndex === -1 || !targetSection) return;

    const nextOrderedSections = buildReorderedSections(
      sectionId,
      targetSection.id,
      direction > 0 ? "after" : "before",
    );
    if (!nextOrderedSections) return;

    await commitSectionOrder(nextOrderedSections);
  };

  const handleSectionDragStart = (
    sectionId: string,
    event: React.DragEvent<HTMLButtonElement>,
  ) => {
    if (reorderingSections) {
      event.preventDefault();
      return;
    }

    setDraggingSectionId(sectionId);
    setSectionDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
  };

  const handleSectionDragOver = (
    sectionId: string,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    if (reorderingSections || !draggingSectionId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const position = getSectionDropPosition(event);
    setSectionDropTarget((current) => {
      if (
        current?.sectionId === sectionId &&
        current.position === position
      ) {
        return current;
      }
      return { sectionId, position };
    });
  };

  const handleSectionDrop = async (
    sectionId: string,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    if (reorderingSections || !draggingSectionId) {
      clearSectionDragState();
      return;
    }

    const nextOrderedSections = buildReorderedSections(
      draggingSectionId,
      sectionId,
      getSectionDropPosition(event),
    );
    if (!nextOrderedSections) {
      clearSectionDragState();
      return;
    }

    await commitSectionOrder(nextOrderedSections);
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-foreground-muted" aria-hidden />
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
          <ArrowLeft className="size-4" /> {t("courseEdit.page.back")}
        </Link>
      </div>
    );
  }

  if (!course || !canAccessEditor) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-foreground-muted">
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

  const translationCoverageItems: Array<{
    key: CoverageFieldKey;
    label: string;
    currentFilled: boolean;
    sourceFilled: boolean;
  }> = (() => {
    const sourceLocale = sourceLocaleFor(activeContentLocale);
    const sourceContent =
      sourceLocale === primaryContentLocale
        ? {
            title: course.title ?? "",
            short_description: course.short_description ?? "",
            description: course.description ?? "",
            learning_outcomes: course.learning_outcomes ?? [],
            final_assignment_title: course.final_assignment_title ?? "",
            final_assignment_description: course.final_assignment_description ?? "",
            final_assignment_instructions: course.final_assignment_instructions ?? "",
          }
        : {
            title: contentForm.title,
            short_description: contentForm.short_description,
            description: contentForm.description,
            learning_outcomes: contentForm.learning_outcomes,
            final_assignment_title: contentForm.final_assignment_title,
            final_assignment_description: contentForm.final_assignment_description,
            final_assignment_instructions: contentForm.final_assignment_instructions,
          };

    const normalizeList = (items: string[] | undefined) =>
      (items ?? []).map((item) => item.trim()).filter(Boolean);
    const hasText = (value: string | null | undefined) => Boolean(value?.trim());

    return [
      {
        key: "title",
        label: t("courseEdit.translationCoverage.fields.title"),
        currentFilled: hasText(contentForm.title),
        sourceFilled: hasText(sourceContent.title),
      },
      {
        key: "short_description",
        label: t("courseEdit.translationCoverage.fields.shortDescription"),
        currentFilled: hasText(contentForm.short_description),
        sourceFilled: hasText(sourceContent.short_description),
      },
      {
        key: "description",
        label: t("courseEdit.translationCoverage.fields.description"),
        currentFilled: hasText(contentForm.description),
        sourceFilled: hasText(sourceContent.description),
      },
      {
        key: "learning_outcomes",
        label: t("courseEdit.translationCoverage.fields.learningOutcomes"),
        currentFilled: normalizeList(contentForm.learning_outcomes).length > 0,
        sourceFilled: normalizeList(sourceContent.learning_outcomes).length > 0,
      },
      {
        key: "final_assignment_title",
        label: t("courseEdit.translationCoverage.fields.assignmentTitle"),
        currentFilled: hasText(contentForm.final_assignment_title),
        sourceFilled: hasText(sourceContent.final_assignment_title),
      },
      {
        key: "final_assignment_description",
        label: t("courseEdit.translationCoverage.fields.assignmentDescription"),
        currentFilled: hasText(contentForm.final_assignment_description),
        sourceFilled: hasText(sourceContent.final_assignment_description),
      },
      {
        key: "final_assignment_instructions",
        label: t("courseEdit.translationCoverage.fields.assignmentInstructions"),
        currentFilled: hasText(contentForm.final_assignment_instructions),
        sourceFilled: hasText(sourceContent.final_assignment_instructions),
      },
    ];
  })();

  const translationCoverageStats = {
    completed: translationCoverageItems.filter((item) => item.currentFilled).length,
    total: translationCoverageItems.length,
    missingButSourceReady: translationCoverageItems.filter(
      (item) => !item.currentFilled && item.sourceFilled,
    ).length,
  };

  const focusCoverageField = (
    key: CoverageFieldKey,
  ) => {
    if (
      key === "final_assignment_title" ||
      key === "final_assignment_description" ||
      key === "final_assignment_instructions"
    ) {
      setSection("assignments");
    } else {
      setSection("info");
    }
    window.setTimeout(() => {
      courseFieldRefs.current[key]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  };

  const handleTranslateCoverageField = (
    key: CoverageFieldKey,
  ) => {
    const sourceLocale = sourceLocaleFor(activeContentLocale);
    const sourceContent =
      sourceLocale === primaryContentLocale
        ? {
            title: course.title ?? "",
            short_description: course.short_description ?? "",
            description: course.description ?? "",
            learning_outcomes: course.learning_outcomes ?? [],
            final_assignment_title: course.final_assignment_title ?? "",
            final_assignment_description: course.final_assignment_description ?? "",
            final_assignment_instructions: course.final_assignment_instructions ?? "",
          }
        : {
            title: contentForm.title,
            short_description: contentForm.short_description,
            description: contentForm.description,
            learning_outcomes: contentForm.learning_outcomes,
            final_assignment_title: contentForm.final_assignment_title,
            final_assignment_description: contentForm.final_assignment_description,
            final_assignment_instructions: contentForm.final_assignment_instructions,
          };

    const labelByKey = {
      title: t("courseEdit.translationCoverage.fields.title"),
      short_description: t("courseEdit.translationCoverage.fields.shortDescription"),
      description: t("courseEdit.translationCoverage.fields.description"),
      learning_outcomes: t("courseEdit.translationCoverage.fields.learningOutcomes"),
      final_assignment_title: t("courseEdit.translationCoverage.fields.assignmentTitle"),
      final_assignment_description: t("courseEdit.translationCoverage.fields.assignmentDescription"),
      final_assignment_instructions: t("courseEdit.translationCoverage.fields.assignmentInstructions"),
    } as const;

    const generatorTargetField =
      key === "title" || key === "final_assignment_title"
        ? "title"
        : key === "learning_outcomes"
          ? "learning_outcomes"
          : key === "short_description"
        ? "short_description"
        : "description";

    const sourceText =
      key === "learning_outcomes"
        ? (sourceContent.learning_outcomes ?? []).filter(Boolean).join("\n")
        : String(sourceContent[key] ?? "");

    const sourcePreviews = [
      createSourcePreview({
        id: `coverage-${key}-${sourceLocale}`,
        title: `${labelByKey[key]} · ${localeBadge(sourceLocale)}`,
        shortDescription:
          key === "short_description" || key === "title" || key === "final_assignment_title"
            ? sourceText
            : undefined,
        markdownDescription:
          key === "description" ||
          key === "learning_outcomes" ||
          key === "final_assignment_description" ||
          key === "final_assignment_instructions"
            ? sourceText
            : undefined,
      }),
    ];

    openDescriptionGenerator({
      title: t("courseEdit.descriptionGenerator.translateCourseTitle"),
      description: t("courseEdit.descriptionGenerator.translateCourseDescription", {
        source: sourceLocale.toUpperCase(),
        target: activeContentLocale.toUpperCase(),
      }),
      type: "course",
      targetField: generatorTargetField,
      locale: activeContentLocale,
      sourcePreviews,
      warning: buildGeneratorWarning(sourcePreviews),
      actionLabel: t("courseEdit.descriptionGenerator.translateTrigger"),
      loadingLabel: t("courseEdit.descriptionGenerator.translating"),
      requestBody: {
        action: "translate",
        type: "course",
        targetField: generatorTargetField,
        locale: activeContentLocale,
        sourceLocale,
        sourceInputs: [
          createSourceInput({
            id: `coverage-${key}-${sourceLocale}`,
            title: `${labelByKey[key]} · ${localeBadge(sourceLocale)}`,
            shortDescription:
              key === "short_description" || key === "title" || key === "final_assignment_title"
                ? sourceText
                : undefined,
            markdownDescription:
              key === "description" ||
              key === "learning_outcomes" ||
              key === "final_assignment_description" ||
              key === "final_assignment_instructions"
                ? sourceText
                : undefined,
          }),
        ],
        courseId: id,
      },
      onApply: (value) =>
        setContentForm((prev) => {
          if (key === "learning_outcomes") {
            return {
              ...prev,
              learning_outcomes: value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            };
          }
          return { ...prev, [key]: value };
        }),
    });
  };

  return (
    <PageContainer>
      <div className="mb-4 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              {course.published
                ? t("courseEdit.labels.published")
                : t("courseEdit.labels.draft")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              {getCourseAccessModelLabel(course.access_model)}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              {getCourseLevelLabel(course.level)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {editorStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
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
        <nav className="h-fit shrink-0 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 xl:sticky xl:top-24 xl:w-64">
          {/* Locale switcher — always visible */}
          <div className="mb-3 px-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {t("courseEdit.sidebar.editingLanguage")}
            </p>
            <div className="flex gap-1">
              {supportedLocales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setActiveContentLocale(loc)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
                    activeContentLocale === loc
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                  )}
                >
                  <span>{loc === "vi" ? "🇻🇳" : "🇬🇧"}</span>
                  {loc.toUpperCase()}
                  {loc === primaryContentLocale && (
                    <span className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] leading-none">
                      {t("courseEdit.sidebar.primaryBadge")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {t("courseEdit.sidebar.navTitle")}
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("courseEdit.sidebar.navHint")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.info")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <DollarSign className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.pricing")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <List className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.content")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.assignments")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Award className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.certificate")}
              </button>
            </li>
            ) : null}
            {canAccessAnnouncements ? (
            <li>
              <button
                type="button"
                onClick={() => setSection("announcements")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeSection === "announcements"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.announcements")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Users className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.students")}
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
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                {t("courseEdit.sidebar.nav.danger")}
              </button>
            </li>
            ) : null}
          </ul>
        </nav>

        {/* Nội dung theo section đang chọn */}
        <div className="min-w-0 flex-1">
          {activeSection === "info" && canAccessInfo && (
            <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
              <h2 className="text-lg font-medium text-foreground">
                {t("courseEdit.sidebar.nav.info")}
              </h2>
              <FieldGroup className="mt-4">
                {/* Locale config — advanced, collapsed into a summary row */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                    <span className="font-medium text-foreground">{t("courseEdit.i18n.supportedLocalesLabel")}:</span>
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
                              if (result.length === 0) return prev;
                              if (!result.includes(primaryContentLocale)) setPrimaryContentLocale(result[0] ?? "vi");
                              if (!result.includes(activeContentLocale)) setActiveContentLocale(result[0] ?? "vi");
                              return result;
                            })
                          }
                          className={cn(
                            "rounded border px-2 py-0.5 text-xs font-medium transition-colors",
                            enabled
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border-subtle bg-surface-base text-foreground-muted",
                          )}
                        >
                          {loc === "vi" ? "🇻🇳" : "🇬🇧"} {loc.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                    <span className="font-medium text-foreground">{t("courseEdit.i18n.primaryLocaleLabel")}:</span>
                    <select
                      value={primaryContentLocale}
                      onChange={(e) => setPrimaryContentLocale(normalizeCourseLocale(e.target.value))}
                      className="rounded border border-border bg-surface-base px-2 py-0.5 text-xs outline-none"
                    >
                      {supportedLocales.map((loc) => (
                        <option key={loc} value={loc}>{loc.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {activeContentLocale !== primaryContentLocale && (
                  <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">
                        {t("courseEdit.i18n.translationModeBadge")}
                      </span>
                      <span className="text-sm font-medium">
                        {localeBadge(primaryContentLocale)} → {localeBadge(activeContentLocale)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground-muted">
                      {t("courseEdit.i18n.editingNonPrimaryHint")}
                    </p>
                  </div>
                )}
                {activeContentLocale !== primaryContentLocale ? (
                  <Card className="border-primary/15 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("courseEdit.translationCoverage.title")}
                          </p>
                          <p className="mt-1 text-sm text-foreground-muted">
                            {t("courseEdit.translationCoverage.description" as never, {
                              source: primaryContentLocale.toUpperCase(),
                              target: activeContentLocale.toUpperCase(),
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="inline-flex items-center gap-1.5"
                            disabled={
                              translatingBundle === "course_info" ||
                              !bundleHasSource({
                                title: course.title ?? "",
                                shortDescription: course.short_description ?? "",
                                description: course.description ?? "",
                                learningOutcomes: course.learning_outcomes ?? [],
                              })
                            }
                            onClick={handleTranslateCourseInfoBundle}
                          >
                            {translatingBundle === "course_info" ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <Sparkles className="size-4" aria-hidden />
                            )}
                            {translatingBundle === "course_info"
                              ? t("courseEdit.descriptionGenerator.translating")
                              : t("courseEdit.descriptionGenerator.translateTrigger")}
                          </Button>
                          <span className="rounded-full bg-surface-base px-2.5 py-1 text-xs font-semibold text-foreground">
                            {t("courseEdit.translationCoverage.completed" as never, {
                              completed: translationCoverageStats.completed,
                              total: translationCoverageStats.total,
                            })}
                          </span>
                          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
                            {t("courseEdit.translationCoverage.readyToTranslate" as never, {
                              count: translationCoverageStats.missingButSourceReady,
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {translationCoverageItems.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => focusCoverageField(item.key)}
                            className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 text-left transition hover:border-primary/30 hover:bg-surface-raised"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{item.label}</p>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-[11px] font-semibold",
                                  item.currentFilled
                                    ? "bg-success/15 text-success"
                                    : item.sourceFilled
                                      ? "bg-warning/15 text-warning"
                                      : "bg-surface-raised text-foreground-muted",
                                )}
                              >
                                {item.currentFilled
                                  ? t("courseEdit.translationCoverage.states.done")
                                  : item.sourceFilled
                                    ? t("courseEdit.translationCoverage.states.ready")
                                    : t("courseEdit.translationCoverage.states.missing")}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-foreground-muted">
                              {item.currentFilled
                                ? t("courseEdit.translationCoverage.messages.filled" as never, {
                                    locale: activeContentLocale.toUpperCase(),
                                  })
                                : item.sourceFilled
                                  ? t("courseEdit.translationCoverage.messages.sourceAvailable" as never, {
                                      locale: primaryContentLocale.toUpperCase(),
                                    })
                                  : t("courseEdit.translationCoverage.messages.noSource")}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-medium text-foreground-muted">
                                {t("courseEdit.translationCoverage.actions.openField")}
                              </span>
                              {!item.currentFilled && item.sourceFilled ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleTranslateCoverageField(item.key);
                                  }}
                                >
                                  <Sparkles className="mr-1 size-3.5" aria-hidden />
                                  {t("courseEdit.descriptionGenerator.translateTrigger")}
                                </Button>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <div
                  ref={(node) => {
                    courseFieldRefs.current.title = node;
                  }}
                >
                <Field>
                  <FieldLabel>
                    {t("courseEdit.form.titleLabel")}
                    <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                      {activeContentLocale.toUpperCase()}
                    </span>
                  </FieldLabel>
                  <Input
                    value={contentForm.title}
                    onChange={(e) =>
                      setContentForm((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </Field>
                </div>
                <Field>
                  <FieldLabel>Slug</FieldLabel>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, slug: e.target.value }))
                    }
                  />
                </Field>
                <div
                  ref={(node) => {
                    courseFieldRefs.current.short_description = node;
                  }}
                >
                <Field>
                  <FieldLabel>
                    <span>{t("courseEdit.form.shortDescriptionLabel")}</span>
                    <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                      {activeContentLocale.toUpperCase()}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-2 inline-flex items-center gap-1"
                      onClick={() => handleGenerateCourseDescription("short_description")}
                    >
                      <Sparkles className="size-4" aria-hidden />
                      {t("courseEdit.descriptionGenerator.trigger")}
                    </Button>
                    {activeContentLocale !== primaryContentLocale ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        onClick={() => openTranslateCourseField("short_description")}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {t("courseEdit.descriptionGenerator.translateTrigger")}
                      </Button>
                    ) : null}
                  </FieldLabel>
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
                </div>
                <div
                  ref={(node) => {
                    courseFieldRefs.current.description = node;
                  }}
                >
                <Field>
                  <FieldLabel>
                    <span>{t("courseEdit.form.descriptionLabel")}</span>
                    <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                      {activeContentLocale.toUpperCase()}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-2 inline-flex items-center gap-1"
                      onClick={() => handleGenerateCourseDescription("description")}
                    >
                      <Sparkles className="size-4" aria-hidden />
                      {t("courseEdit.descriptionGenerator.trigger")}
                    </Button>
                    {activeContentLocale !== primaryContentLocale ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        onClick={() => openTranslateCourseField("description")}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {t("courseEdit.descriptionGenerator.translateTrigger")}
                      </Button>
                    ) : null}
                  </FieldLabel>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("courseEdit.form.descriptionMarkdownHint")}
                  </p>
                  <textarea
                    value={contentForm.description}
                    onChange={(e) =>
                      setContentForm((p) => ({ ...p, description: e.target.value }))
                    }
                    className="min-h-[140px] w-full rounded border border-border bg-surface-base px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    rows={4}
                  />
                </Field>
                </div>
                <div
                  ref={(node) => {
                    courseFieldRefs.current.learning_outcomes = node;
                  }}
                >
                <Field>
                  <FieldLabel>
                    {t("courseEdit.form.learningOutcomesLabel")}
                    <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                      {activeContentLocale.toUpperCase()}
                    </span>
                    {activeContentLocale !== primaryContentLocale ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        disabled={
                          translatingBundle === "learning_outcomes" ||
                          !(course?.learning_outcomes?.length)
                        }
                        onClick={handleTranslateLearningOutcomes}
                      >
                        {translatingBundle === "learning_outcomes" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        {translatingBundle === "learning_outcomes"
                          ? t("courseEdit.descriptionGenerator.translating")
                          : t("courseEdit.descriptionGenerator.translateTrigger")}
                      </Button>
                    ) : null}
                  </FieldLabel>
                  <p className="mt-1 text-xs text-foreground-muted">
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
                </div>

                {course && canEditCoInstructors ? (
                  <Field>
                    <FieldLabel>
                      {t("courseEdit.coInstructors.label")}
                    </FieldLabel>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("courseEdit.coInstructors.hint")}
                    </p>

                    <div className="mt-3 space-y-3">
                      <ProfileCombobox
                        title={t("courseEdit.coInstructors.dialogTitle")}
                        description={t("courseEdit.coInstructors.dialogDescription")}
                        options={
                          instructorDirectory
                            .filter((p) => p.id !== course.instructor_id)
                            .filter(
                              (p) =>
                                !pendingCoInstructorInvites.some(
                                  (inv) => inv.invitee_user_id === p.id,
                                ),
                            )
                            .map(
                              (p): ProfileComboboxOption => ({
                                id: p.id,
                                label:
                                  p.full_name ??
                                  p.email ??
                                  t("courseEdit.coInstructors.fallbackName"),
                                description:
                                  p.instructor_headline ??
                                  p.instructor_organization ??
                                  null,
                              }),
                            )
                        }
                        placeholder={t("courseEdit.coInstructors.placeholder")}
                        searchPlaceholder={t("courseEdit.coInstructors.searchPlaceholder")}
                        emptyLabel={t("courseEdit.coInstructors.emptyLabel")}
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
                        <p className="text-xs text-foreground-muted">
                          {t("courseEdit.coInstructors.loadingDirectory")}
                        </p>
                      ) : null}

                      {pendingCoInstructorInvites.length > 0 ? (
                        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                            {t("courseEdit.coInstructors.pendingTitle")}
                          </div>
                          <p className="text-xs text-foreground-muted">
                            {t("courseEdit.coInstructors.pendingHint")}
                          </p>
                          {pendingCoInstructorInvites.map((inv) => {
                            const display =
                              instructorDirectory.find((p) => p.id === inv.invitee_user_id)
                                ?.full_name ??
                              instructorDirectory.find((p) => p.id === inv.invitee_user_id)
                                ?.email ??
                              inv.invitee_user_id;
                            const perms = inv.permissions ?? {};
                            const permKeys = Object.entries(perms)
                              .filter(([, v]) => v === true)
                              .map(([k]) => k);
                            return (
                              <div
                                key={inv.id}
                                className="flex items-start justify-between gap-2 rounded-md border border-border-subtle bg-surface-base p-3"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground">
                                    {display}
                                  </div>
                                  <div className="mt-0.5 text-xs text-foreground-muted">
                                    {inv.invitee_user_id}
                                  </div>
                                  <div className="mt-1 text-xs text-foreground-muted">
                                    {t("courseEdit.coInstructors.pendingExpiresAt", {
                                      date: new Date(inv.expires_at).toLocaleString(),
                                    })}
                                  </div>
                                  {permKeys.length > 0 ? (
                                    <div className="mt-1 text-xs text-foreground-muted">
                                      {permKeys.join(", ")}
                                    </div>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => handleRevokeCoInstructorInvite(inv.id)}
                                >
                                  {t("courseEdit.coInstructors.revokeInvite")}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
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
                            const willInvite =
                              !acceptedCoInstructorIdsSnapshot.includes(cid);
                            return (
                              <div
                                key={cid}
                                className="rounded-md border border-border-subtle bg-surface-raised p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                      {display}
                                      {willInvite ? (
                                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                          {t("courseEdit.coInstructors.willInviteBadge")}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="mt-0.5 text-xs text-foreground-muted">
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
                                        className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-base shadow-card px-3 py-2 text-sm"
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
                                            t(item.labelKey as never),
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })}
                                  <label className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-base shadow-card px-3 py-2 text-sm sm:col-span-2">
                                    <input
                                      type="checkbox"
                                      checked={coInstructorVisibility[cid] !== false}
                                      onChange={(e) => {
                                        setCoInstructorVisibility((prev) => ({
                                          ...prev,
                                          [cid]: e.target.checked,
                                        }));
                                      }}
                                    />
                                    <span className="text-foreground">
                                      {t("courseEdit.coInstructors.showOnCoursePage")}
                                    </span>
                                  </label>
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
                  <FieldLabel>
                    {t("courseEdit.sponsors.label")}
                  </FieldLabel>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("courseEdit.sponsors.hint")}
                  </p>

                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-2"
                        onClick={openAddSponsor}
                      >
                        <Plus className="size-4" aria-hidden />
                        {t("courseEdit.sponsors.actions.add")}
                      </Button>
                      <span className="text-xs text-foreground-muted">
                        {t("courseEdit.sponsors.countLabel", { count: sponsors.length })}
                      </span>
                    </div>

                    {sponsors.length > 0 ? (
                      <div className="space-y-2">
                        {sponsors.map((s) => {
                          const sid = String(s.id ?? "").trim();
                          const lc = s.locale_content?.[activeContentLocale];
                          const name = (lc?.name?.trim() || s.name || "").trim();
                          const description = lc?.description?.trim() || s.description || "";
                          const logoSrc =
                            s.logo_url && String(s.logo_url).trim()
                              ? String(s.logo_url)
                              : null;
                          const website = isValidHttpUrl(s.website)
                            ? String(s.website)
                            : "";

                          return (
                            <div
                              key={sid || name}
                              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                {logoSrc ? (
                                  <img
                                    src={logoSrc}
                                    alt={name}
                                    loading="lazy"
                                    decoding="async"
                                    className="size-10 shrink-0 rounded-2xl border border-border-subtle bg-surface-base shadow-card object-contain"
                                  />
                                ) : (
                                  <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-raised text-xs font-semibold text-foreground-muted">
                                    {(name || "?").slice(0, 2).toUpperCase()}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    {name || sid}
                                  </div>
                                  {website ? (
                                    <a
                                      href={website}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 block truncate text-xs text-primary hover:underline"
                                    >
                                      {website}
                                    </a>
                                  ) : null}
                                  {description ? (
                                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground-muted">
                                      {description}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3"
                                  onClick={() => openEditSponsor(s)}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3 text-destructive hover:text-destructive"
                                  onClick={() => void removeSponsor(s)}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-foreground-muted">
                        {t("courseEdit.sponsors.empty")}
                      </p>
                    )}
                  </div>

                  <Dialog open={sponsorDialogOpen} onOpenChange={setSponsorDialogOpen}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>
                          {t("courseEdit.sponsors.dialog.title")}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <Field>
                          <FieldLabel>
                            {t("courseEdit.sponsors.fields.logo")}
                          </FieldLabel>
                          <div className="mt-2 flex items-center gap-3">
                            <input
                              ref={sponsorLogoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleSponsorLogoChange}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingSponsorLogo || !id}
                              onClick={() => sponsorLogoInputRef.current?.click()}
                            >
                              {uploadingSponsorLogo
                                ? t("courseEdit.sponsors.actions.uploading")
                                : t("courseEdit.sponsors.actions.uploadLogo")}
                            </Button>
                            {sponsorForm.logo_url ? (
                              <img
                                src={sponsorForm.logo_url}
                                alt=""
                                className="size-10 rounded-2xl border border-border-subtle bg-surface-base shadow-card object-contain"
                              />
                            ) : null}
                          </div>
                        </Field>

                        {/* Locale tabs */}
                        <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
                          {(["vi", "en"] as const).map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => setSponsorDialogLocale(loc)}
                              className={cn(
                                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                sponsorDialogLocale === loc
                                  ? "bg-surface-base text-foreground shadow-sm"
                                  : "text-foreground-muted hover:text-foreground",
                              )}
                            >
                              {loc === "vi" ? "🇻🇳 Tiếng Việt" : "🇬🇧 English"}
                            </button>
                          ))}
                        </div>

                        <Field>
                          <FieldLabel>
                            {t("courseEdit.sponsors.fields.name")}
                          </FieldLabel>
                          <Input
                            value={sponsorForm.locale_content[sponsorDialogLocale].name}
                            onChange={(e) =>
                              setSponsorForm((p) => ({
                                ...p,
                                locale_content: {
                                  ...p.locale_content,
                                  [sponsorDialogLocale]: { ...p.locale_content[sponsorDialogLocale], name: e.target.value },
                                },
                              }))
                            }
                          />
                        </Field>

                        <Field>
                          <FieldLabel>
                            {t("courseEdit.sponsors.fields.website")}
                          </FieldLabel>
                          <Input
                            value={sponsorForm.website}
                            onChange={(e) =>
                              setSponsorForm((p) => ({
                                ...p,
                                website: e.target.value,
                              }))
                            }
                            placeholder="https://..."
                          />
                        </Field>

                        <Field>
                          <FieldLabel>
                            {t("courseEdit.sponsors.fields.description")}
                          </FieldLabel>
                          <textarea
                            value={sponsorForm.locale_content[sponsorDialogLocale].description}
                            onChange={(e) =>
                              setSponsorForm((p) => ({
                                ...p,
                                locale_content: {
                                  ...p.locale_content,
                                  [sponsorDialogLocale]: { ...p.locale_content[sponsorDialogLocale], description: e.target.value },
                                },
                              }))
                            }
                            className="min-h-[120px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                            rows={4}
                          />
                        </Field>
                      </div>

                      <DialogFooter className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSponsorDialogOpen(false)}
                        >
                          {t("courseEdit.sponsors.actions.cancel")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void saveSponsorFromDialog()}
                          disabled={uploadingSponsorLogo}
                        >
                          {t("courseEdit.sponsors.actions.save")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Field>

                <Field>
                  <FieldLabel>
                    {t("courseEdit.partners.label")}
                  </FieldLabel>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("courseEdit.partners.hint")}
                  </p>

                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-2"
                        onClick={openAddPartner}
                        disabled={!canEdit}
                      >
                        <Plus className="size-4" aria-hidden />
                        {t("courseEdit.partners.actions.add")}
                      </Button>
                      <span className="text-xs text-foreground-muted">
                        {t("courseEdit.partners.countLabel", { count: partners.length })}
                      </span>
                    </div>

                    {partners.length > 0 ? (
                      <div className="space-y-2">
                        {partners.map((p) => {
                          const pid = String(p.id ?? "").trim();
                          const plc = p.locale_content?.[activeContentLocale];
                          const name = (plc?.name?.trim() || p.name || "").trim();
                          const pDescription = plc?.description?.trim() || p.description || "";
                          const logoSrc =
                            p.logo_url && String(p.logo_url).trim()
                              ? String(p.logo_url)
                              : null;
                          const website = isValidHttpUrl(p.website)
                            ? String(p.website)
                            : "";

                          return (
                            <div
                              key={pid || name}
                              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                {logoSrc ? (
                                  <img
                                    src={logoSrc}
                                    alt={name}
                                    loading="lazy"
                                    decoding="async"
                                    className="size-10 shrink-0 rounded-2xl border border-border-subtle bg-surface-base shadow-card object-contain"
                                  />
                                ) : (
                                  <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-raised text-xs font-semibold text-foreground-muted">
                                    {(name || "?").slice(0, 2).toUpperCase()}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    {name || pid}
                                  </div>
                                  {website ? (
                                    <a
                                      href={website}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 block truncate text-xs text-primary hover:underline"
                                    >
                                      {website}
                                    </a>
                                  ) : null}
                                  {pDescription ? (
                                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground-muted">
                                      {pDescription}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3"
                                  onClick={() => openEditPartner(p)}
                                  disabled={!canEdit}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3 text-destructive hover:text-destructive"
                                  onClick={() => void removePartner(p)}
                                  disabled={!canEdit}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-foreground-muted">
                        {t("courseEdit.partners.empty")}
                      </p>
                    )}
                  </div>

                  <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>
                          {t("courseEdit.partners.dialog.title")}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <Field>
                          <FieldLabel>
                            {t("courseEdit.partners.fields.logo")}
                          </FieldLabel>
                          <div className="mt-2 flex items-center gap-3">
                            <input
                              ref={partnerLogoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handlePartnerLogoChange}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingPartnerLogo || !canEdit}
                              onClick={() => partnerLogoInputRef.current?.click()}
                            >
                              {uploadingPartnerLogo
                                ? t("courseEdit.partners.actions.uploading")
                                : t("courseEdit.partners.actions.uploadLogo")}
                            </Button>
                            {partnerForm.logo_url ? (
                              <img
                                src={partnerForm.logo_url}
                                alt=""
                                className="size-10 rounded-2xl border border-border-subtle bg-surface-base shadow-card object-contain"
                              />
                            ) : null}
                          </div>
                        </Field>

                        {/* Locale tabs */}
                        <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
                          {(["vi", "en"] as const).map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => setPartnerDialogLocale(loc)}
                              className={cn(
                                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                partnerDialogLocale === loc
                                  ? "bg-surface-base text-foreground shadow-sm"
                                  : "text-foreground-muted hover:text-foreground",
                              )}
                            >
                              {loc === "vi" ? "🇻🇳 Tiếng Việt" : "🇬🇧 English"}
                            </button>
                          ))}
                        </div>

                        <Field>
                          <FieldLabel>
                            {t("courseEdit.partners.fields.name")}
                          </FieldLabel>
                          <Input
                            value={partnerForm.locale_content[partnerDialogLocale].name}
                            onChange={(e) =>
                              setPartnerForm((p) => ({
                                ...p,
                                locale_content: {
                                  ...p.locale_content,
                                  [partnerDialogLocale]: { ...p.locale_content[partnerDialogLocale], name: e.target.value },
                                },
                              }))
                            }
                          />
                        </Field>

                        <Field>
                          <FieldLabel>
                            {t("courseEdit.partners.fields.website")}
                          </FieldLabel>
                          <Input
                            value={partnerForm.website}
                            onChange={(e) =>
                              setPartnerForm((p) => ({ ...p, website: e.target.value }))
                            }
                            placeholder="https://..."
                          />
                        </Field>

                        <Field>
                          <FieldLabel>
                            {t("courseEdit.partners.fields.description")}
                          </FieldLabel>
                          <textarea
                            value={partnerForm.locale_content[partnerDialogLocale].description}
                            onChange={(e) =>
                              setPartnerForm((p) => ({
                                ...p,
                                locale_content: {
                                  ...p.locale_content,
                                  [partnerDialogLocale]: { ...p.locale_content[partnerDialogLocale], description: e.target.value },
                                },
                              }))
                            }
                            className="min-h-[120px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                            rows={4}
                          />
                        </Field>
                      </div>

                      <DialogFooter className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPartnerDialogOpen(false)}
                        >
                          {t("courseEdit.partners.actions.cancel")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void savePartnerFromDialog()}
                          disabled={uploadingPartnerLogo}
                        >
                          {t("courseEdit.partners.actions.save")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Field>

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
                      <FieldLabel>{t("courseEdit.business.ownershipLabel")}</FieldLabel>
                      <select
                        value={form.owner_type}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            owner_type: e.target.value as CourseOwnerType,
                          }))
                        }
                        disabled={!canManageBusinessSettings}
                        className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60"
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
                          {t("courseEdit.business.ownershipAdminOnly")}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.business.ownershipCurrent", {
                          type: getCourseOwnerTypeLabel(form.owner_type),
                        })}
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
                          <p className="mt-1 text-xs text-foreground-muted">
                            {t("courseEdit.business.instructorShare", {
                              percent:
                                100 -
                                Number(form.platform_revenue_share_percent || 0),
                            })}
                          </p>
                        </Field>
                        <Field>
                          <FieldLabel>{t("courseEdit.business.partnerTransferLabel")}</FieldLabel>
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
                            className="min-h-[90px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60"
                            placeholder={t("courseEdit.form.partnerTransferPlaceholder")}
                          />
                          <p className="mt-1 text-xs text-foreground-muted">
                            {t("courseEdit.business.partnerTransferHint")}
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
                            <p className="mt-1 text-xs text-foreground-muted">
                              {t("courseEdit.business.noContractDocs")}
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
                            <p className="mt-1 text-xs text-foreground-muted">
                              {t("courseEdit.business.noInvoiceDocs")}
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
                    className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
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
                      className="rounded border-border"
                    />
                    <span className="text-sm font-medium">
                      {t("courseEdit.publishing.publishedHint")}
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
                      <span className="font-medium">{t("courseEdit.externalCourse.toggleLabel")}</span>
                      <span className="mt-1 block text-xs text-foreground-muted">
                        {t("courseEdit.externalCourse.toggleHint")}
                      </span>
                    </span>
                  </label>
                </Field>
                {form.is_external_aggregated ? (
                  <>
                    <Field>
                      <FieldLabel>{t("courseEdit.externalCourse.sourcesLabel")}</FieldLabel>
                      <textarea
                        value={form.external_source_urls_text}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            external_source_urls_text: e.target.value,
                          }))
                        }
                        className="min-h-[100px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                        rows={4}
                        placeholder={t("courseEdit.externalCourse.sourcesPlaceholder")}
                      />
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.externalCourse.sourcesRequired")}
                      </p>
                    </Field>
                    <Field>
                      <FieldLabel>{t("courseEdit.externalCourse.attributionLabel")}</FieldLabel>
                      <textarea
                        value={form.external_source_attribution_note}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            external_source_attribution_note: e.target.value,
                          }))
                        }
                        className="min-h-[80px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                        rows={3}
                        placeholder={t("courseEdit.externalCourse.attributionPlaceholder")}
                      />
                    </Field>
                  </>
                ) : null}
                <Field>
                  <label className={`flex items-center gap-2 ${ocbIsActive ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <input
                      type="checkbox"
                      checked={form.has_certificate ?? false}
                      disabled={ocbIsActive}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          has_certificate: e.target.checked,
                        }))
                      }
                      className="rounded border-border"
                    />
                    <span className="text-sm font-medium">
                      {t("courseEdit.publishing.hasCertificateHint")}
                    </span>
                  </label>
                  {ocbIsActive && (
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("courseEdit.publishing.certBlockedByOcb")}
                    </p>
                  )}
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
                      className="rounded border-border"
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
            <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                <DollarSign className="size-5" aria-hidden /> {t("courseEdit.sidebar.nav.pricing")}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t("courseEdit.pricing.intro")}
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
                    className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
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
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.pricing.paidPreviewHint")}
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
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.pricing.promoMustBeLower")}
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
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.pricing.promoEndsOptional")}
                      </p>
                    </Field>

                    <div className="rounded-md border border-border-subtle bg-surface-raised p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t("courseEdit.pricing.discountsTitle")}
                          </p>
                          <p className="text-xs text-foreground-muted">
                            {t("courseEdit.discounts.createTitle")}
                            {t("courseEdit.discounts.subtitleSuffix")}
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
                        <p className="mt-3 text-xs text-foreground-muted">
                          {t("courseEdit.discounts.empty")}
                        </p>
                      ) : (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-border-subtle bg-surface-raised">
                                <th className="px-3 py-2 font-medium text-foreground">
                                  {t("courseEdit.discounts.table.code")}
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  {t("courseEdit.discounts.table.type")}
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  {t("courseEdit.discounts.table.value")}
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  {t("courseEdit.discounts.table.status")}
                                </th>
                                <th className="px-3 py-2 font-medium text-foreground">
                                  {t("courseEdit.discounts.table.actions")}
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
                                  <td className="px-3 py-2 text-foreground-muted">
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
                                        {t("courseEdit.discounts.table.active")}
                                      </span>
                                    ) : (
                                      <span className="text-foreground-muted text-xs">
                                        {t("courseEdit.discounts.table.inactive")}
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
                                            user,
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
                                            user,
                                          );
                                          setDiscounts((prev) =>
                                            prev.filter((x) => x.id !== d.id),
                                          );
                                        }}
                                      >
                                        {t("courseEdit.discounts.table.delete")}
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
                          <label className="mb-1 block text-xs font-medium text-foreground-muted">
                            {t("courseEdit.discounts.form.code")}
                          </label>
                          <Input
                            value={discountForm.code}
                            onChange={(e) =>
                              setDiscountForm((p) => ({
                                ...p,
                                code: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder={t("courseEdit.discounts.form.codePlaceholder")}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-foreground-muted">
                              {t("courseEdit.discounts.form.type")}
                            </label>
                            <select
                              value={discountForm.type}
                              onChange={(e) =>
                                setDiscountForm((p) => ({
                                  ...p,
                                  type: e.target.value as CourseDiscountType,
                                }))
                              }
                              className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                            >
                              <option value="percent">%</option>
                              <option value="amount_vnd">VND</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-foreground-muted">
                              {t("courseEdit.discounts.form.value")}
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
                          <label className="mb-1 block text-xs font-medium text-foreground-muted">
                            {t("courseEdit.discounts.form.startsAt")}
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
                          <label className="mb-1 block text-xs font-medium text-foreground-muted">
                            {t("courseEdit.discounts.form.endsAt")}
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
                          <label className="mb-1 block text-xs font-medium text-foreground-muted">
                            {t("courseEdit.discounts.form.maxRedemptions")}
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
                                }, user);
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
                    <FieldLabel>{t("courseEdit.pricing.certificateFeeLabel")}</FieldLabel>
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
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("courseEdit.pricing.certificateFeeHint")}
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
            <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <List className="size-5" /> {t("courseEdit.content.heading")}
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {reorderingLessons && (
                    <span className="text-xs text-foreground-muted">
                      {t("courseEdit.content.savingOrder")}
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
              <p className="mt-2 text-xs text-foreground-muted">
                {t("courseEdit.content.dragHint")}
              </p>

              <div className="mt-4 flex items-start gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5">
                <input
                  type="checkbox"
                  id="has-sections-toggle"
                  checked={form.has_sections}
                  onChange={(e) => {
                    const value = e.target.checked;
                    setForm((p) => ({ ...p, has_sections: value }));
                    if (id) void updateCourse(id, { has_sections: value });
                  }}
                  className="mt-0.5 rounded border-border"
                />
                <label htmlFor="has-sections-toggle" className="cursor-pointer text-sm text-foreground">
                  <span className="font-medium">{t("courseEdit.content.sectionsToggleLabel")}</span>
                  <span className="mt-0.5 block text-xs text-foreground-muted">
                    {t("courseEdit.content.sectionsToggleHint")}
                  </span>
                </label>
              </div>

              <div className="mt-4 space-y-4">
                {form.access_model === "paid_upfront" && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                    {t("courseEdit.content.paidUpfrontPreviewBanner")}
                  </div>
                )}
                {lessonsBySection.map(({ section, lessons: secLessons }, sectionIndex) => {
                  const isSectionDragging = draggingSectionId === section.id;
                  const isSectionDropBefore =
                    sectionDropTarget?.sectionId === section.id &&
                    sectionDropTarget.position === "before";
                  const isSectionDropAfter =
                    sectionDropTarget?.sectionId === section.id &&
                    sectionDropTarget.position === "after";

                  return (
                  <div
                    key={section.id}
                    onDragOver={(event) => handleSectionDragOver(section.id, event)}
                    onDrop={(event) => void handleSectionDrop(section.id, event)}
                    onDragEnd={clearSectionDragState}
                    className={cn(
                      "overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card transition-[background-color,border-color,opacity]",
                      isSectionDragging && "opacity-45",
                      isSectionDropBefore && "border-t-2 border-t-primary",
                      isSectionDropAfter && "border-b-2 border-b-primary",
                    )}
                  >
                    {form.has_sections && (
                    <div className="flex items-center justify-between border-b border-border-subtle bg-surface-raised px-4 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          draggable={!reorderingSections}
                          disabled={reorderingSections}
                          onDragStart={(event) => handleSectionDragStart(section.id, event)}
                          onDragEnd={clearSectionDragState}
                          aria-label={t("courseEdit.a11y.dragSection", { title: section.title })}
                          title={t("courseEdit.tooltips.dragReorder")}
                          className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-transparent text-foreground-muted transition hover:border-border-subtle hover:bg-surface-base hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <GripVertical className="size-4" aria-hidden />
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">
                              {activeContentLocale !== primaryContentLocale && sectionLocaleMap.has(section.id)
                                ? (sectionLocaleMap.get(section.id)?.title ?? section.title)
                                : section.title}
                            </span>
                            {activeContentLocale !== primaryContentLocale && !sectionLocaleMap.has(section.id) && (
                              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                {t("courseEdit.sections.notTranslated")}
                              </span>
                            )}
                          </div>
                          {section.description?.trim() ? (
                            <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">
                              {activeContentLocale !== primaryContentLocale && sectionLocaleMap.has(section.id)
                                ? (sectionLocaleMap.get(section.id)?.description ?? section.description)
                                : section.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={reorderingSections || sectionIndex === 0}
                          onClick={() => void handleMoveSection(section.id, -1)}
                          aria-label={t("courseEdit.a11y.moveSectionUp", { title: section.title })}
                          title={t("courseEdit.tooltips.moveUp")}
                        >
                          <ArrowUpFromLine className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={
                            reorderingSections ||
                            sectionIndex === lessonsBySection.length - 1
                          }
                          onClick={() => void handleMoveSection(section.id, 1)}
                          aria-label={t("courseEdit.a11y.moveSectionDown", { title: section.title })}
                          title={t("courseEdit.tooltips.moveDown")}
                        >
                          <ArrowDownToLine className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSection(section)}
                        >
                          {t("courseEdit.sections.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openQuestionGenerator(section)}
                        >
                          {t("courseEdit.sections.questions")}
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
                    )}
                    <ul className="divide-y divide-border-subtle">
                      {secLessons.map((lesson, lessonIndex) => {
                        const resolvedLessonFormat = getLessonFormat(lesson);
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
                                aria-label={t("courseEdit.a11y.dragLesson", { title: lesson.title })}
                                title={t("courseEdit.tooltips.dragReorder")}
                                className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-transparent text-foreground-muted transition hover:border-border-subtle hover:bg-surface-raised hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <GripVertical className="size-4" aria-hidden />
                              </button>
                              {resolvedLessonFormat === "quiz" ? (
                                <CheckSquare className="size-4 shrink-0 text-foreground-muted" />
                              ) : resolvedLessonFormat === "practice" ? (
                                <PenLine className="size-4 shrink-0 text-foreground-muted" />
                              ) : resolvedLessonFormat === "article" ? (
                                <FileText className="size-4 shrink-0 text-foreground-muted" />
                              ) : (
                                <PlayCircle className="size-4 shrink-0 text-foreground-muted" />
                              )}
                              <span className="text-sm text-foreground truncate">
                                {activeContentLocale !== primaryContentLocale && lessonLocaleMap.has(lesson.id)
                                  ? (lessonLocaleMap.get(lesson.id)?.title ?? lesson.title)
                                  : lesson.title}
                              </span>
                              {activeContentLocale !== primaryContentLocale && !lessonLocaleMap.has(lesson.id) && (
                                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning shrink-0">
                                  {t("courseEdit.lessons.notTranslated")}
                                </span>
                              )}
                              {form.access_model === "paid_upfront" &&
                                lesson.is_preview_free && (
                                  <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                    {t("courseEdit.lessons.previewBadge")}
                                  </span>
                                )}
                              {isLessonDraftForLearners(lesson) ? (
                                <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                                  {t("courseEdit.lessons.draftBadge")}
                                </span>
                              ) : null}
                              {lesson.duration_seconds > 0 ? (
                                <span className="shrink-0 text-xs text-foreground-muted">
                                  {formatDuration(lesson.duration_seconds)}
                                </span>
                              ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
                                aria-label={t("courseEdit.a11y.moveLessonUp", { title: lesson.title })}
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
                                aria-label={t("courseEdit.a11y.moveLessonDown", { title: lesson.title })}
                                title={t("courseEdit.tooltips.moveDown")}
                              >
                                <ArrowDownToLine className="size-4" aria-hidden />
                              </Button>
                              {form.access_model === "paid_upfront" && (
                                <label className="inline-flex items-center gap-2 text-xs text-foreground-muted">
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
                                    className="rounded border-border"
                                  />
                                  {t("courseEdit.lessons.previewFreeBadge")}
                                </label>
                              )}
                              {resolvedLessonFormat === "quiz" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openLessonQuizGenerator(lesson)}
                                >
                                  {t("courseEdit.lessons.lessonQuestions")}
                                </Button>
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
                    {form.has_sections && (
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
                          setNewPracticeSourceLessonId("");
                          setNewPracticeSourceLessonIds(new Set());
                          setNewQuizQuestions([]);
                          resetNewQuizGenerationState();
                          setNewLessonFormat("video");
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <Plus className="size-4" /> {t("courseEdit.lessons.create")}
                      </Button>
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {form.has_sections ? (
              <div className="mt-4 rounded-md border border-dashed border-border-subtle p-4">
                <p className="text-sm text-foreground-muted mb-2">
                  {t("courseEdit.content.addSectionHeading")}
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
                    className="min-h-[72px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
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
              ) : (
              <div className="mt-4">
                <Button
                  onClick={() => void handleAddLessonDirect()}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-1"
                >
                  <Plus className="size-4" /> {t("courseEdit.lessons.create")}
                </Button>
              </div>
              )}
            </section>
          )}

          <Dialog open={!!editingSection} onOpenChange={(open) => !open && setEditingSection(null)}>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle>{t("courseEdit.sections.editTitle")}</DialogTitle>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {dialogSectionLocale !== primaryContentLocale ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="inline-flex items-center gap-1.5"
                        disabled={translatingBundle === "section"}
                        onClick={handleTranslateSectionBundle}
                      >
                        {translatingBundle === "section" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        {translatingBundle === "section"
                          ? t("courseEdit.descriptionGenerator.translating")
                          : t("courseEdit.descriptionGenerator.translateTrigger")}
                      </Button>
                    ) : null}
                    <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
                      {supportedLocales.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => switchDialogSectionLocale(loc)}
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                            dialogSectionLocale === loc
                              ? "bg-surface-base text-foreground"
                              : "text-foreground-muted hover:text-foreground",
                          )}
                        >
                          {loc === "vi" ? "🇻🇳" : "🇬🇧"} {loc.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                {dialogSectionLocale !== primaryContentLocale ? (
                  <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">
                        {t("courseEdit.i18n.translationModeBadge")}
                      </span>
                      <span className="text-sm font-medium">
                        {localeBadge(primaryContentLocale)} → {localeBadge(dialogSectionLocale)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground-muted">
                      {t("courseEdit.descriptionGenerator.translateDialogHint")}
                    </p>
                  </div>
                ) : null}
                <Field>
                  <FieldLabel>
                    {t("courseEdit.sections.titleLabel")}
                    <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                      {dialogSectionLocale.toUpperCase()}
                    </span>
                  </FieldLabel>
                  <Input
                    value={editingSectionTitle}
                    onChange={(e) => setEditingSectionTitle(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    <span>{t("courseEdit.sections.descriptionLabel")}</span>
                    <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                      {dialogSectionLocale.toUpperCase()}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-2 inline-flex items-center gap-1"
                      onClick={handleGenerateSectionDescription}
                    >
                      <Sparkles className="size-4" aria-hidden />
                      {t("courseEdit.descriptionGenerator.trigger")}
                    </Button>
                  </FieldLabel>
                  <textarea
                    value={editingSectionDescription}
                    onChange={(e) => setEditingSectionDescription(e.target.value)}
                    placeholder={t("courseEdit.sections.descriptionPlaceholder")}
                    className="min-h-[100px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
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
                <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-surface-float/95 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle>{t("courseEdit.lessons.editTitle")}</DialogTitle>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {dialogLessonLocale !== primaryContentLocale ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="inline-flex items-center gap-1.5"
                          disabled={translatingBundle === "lesson"}
                          onClick={handleTranslateLessonBundle}
                        >
                          {translatingBundle === "lesson" ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Sparkles className="size-4" aria-hidden />
                          )}
                          {translatingBundle === "lesson"
                            ? t("courseEdit.descriptionGenerator.translating")
                            : t("courseEdit.descriptionGenerator.translateTrigger")}
                        </Button>
                      ) : null}
                      <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
                        {supportedLocales.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => switchDialogLessonLocale(loc)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                              dialogLessonLocale === loc
                                ? "bg-surface-base text-foreground"
                                : "text-foreground-muted hover:text-foreground",
                            )}
                          >
                            {loc === "vi" ? "🇻🇳" : "🇬🇧"} {loc.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  {dialogLessonLocale !== primaryContentLocale ? (
                    <div className="mb-4 rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">
                          {t("courseEdit.i18n.translationModeBadge")}
                        </span>
                        <span className="text-sm font-medium">
                          {localeBadge(primaryContentLocale)} → {localeBadge(dialogLessonLocale)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground-muted">
                        {t("courseEdit.descriptionGenerator.translateDialogHint")}
                      </p>
                    </div>
                  ) : null}
                  {editingLesson && (lessonLearnerCounts[editingLesson.id] ?? 0) > 0 ? (
                    <div
                      role="alert"
                      className="mb-4 flex gap-2 rounded-md border border-amber-500/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
                    >
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-warning"
                        aria-hidden
                      />
                      <p>
                        {t("courseEdit.lessons.progressLockBanner", {
                          count: lessonLearnerCounts[editingLesson.id] ?? 0,
                        })}
                      </p>
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "grid gap-6",
                      editingLessonFormat !== "quiz" &&
                        "md:grid-cols-[minmax(0,1fr)_360px]",
                    )}
                  >
                <div className="space-y-4 md:pr-2">
                  {dialogLessonLocale === primaryContentLocale ? (
                    <Field>
                      <FieldLabel>{t("courseEdit.lessons.formatLabel")}</FieldLabel>
                      <LessonFormatSelector
                        value={editingLessonFormat}
                        onChange={(next) => {
                          setEditingLessonFormat(next);
                          if (next !== "video") setEditingLessonYoutubeUrl("");
                          if (next === "quiz") {
                            setEditingLessonShortDescription("");
                            setEditingLessonMarkdown("");
                            setEditingLessonMinutes("");
                            setEditingLessonResources([]);
                          } else if (next === "practice") {
                            setEditingLessonShortDescription("");
                            setEditingLessonMinutes("");
                            setEditingLessonResources([]);
                            const source = getPracticeSourceLessons(
                              editingLesson?.section_id,
                              editingLesson?.id,
                            ).at(-1);
                            const seedIds = editingPracticeSourceLessonIds.size
                              ? editingPracticeSourceLessonIds
                              : new Set(source?.id ? [source.id] : []);
                            setEditingPracticeSourceLessonIds(new Set(seedIds));
                            setEditingPracticeSourceLessonId(Array.from(seedIds)[0] ?? "");
                          }
                        }}
                        videoLabel={t("courseEdit.lessons.formatVideo")}
                        articleLabel={t("courseEdit.lessons.formatArticle")}
                        quizLabel={t("courseEdit.lessons.formatQuiz")}
                        practiceLabel={t("courseEdit.lessons.formatPractice")}
                        hint={t("courseEdit.lessons.formatHint")}
                        disabled={
                          !!editingLesson &&
                          (lessonLearnerCounts[editingLesson.id] ?? 0) > 0
                        }
                      />
                    </Field>
                  ) : null}
                  {dialogLessonLocale === primaryContentLocale &&
                  editingLessonFormat === "video" ? (
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.youtubeLabel")}</FieldLabel>
                    <Input
                      value={editingLessonYoutubeUrl}
                      onChange={(e) => setEditingLessonYoutubeUrl(e.target.value)}
                      placeholder={t("courseEdit.lessons.youtubePlaceholder")}
                      readOnly={
                        !!editingLesson &&
                        (lessonLearnerCounts[editingLesson.id] ?? 0) > 0
                      }
                      disabled={
                        !!editingLesson &&
                        (lessonLearnerCounts[editingLesson.id] ?? 0) > 0
                      }
                      title={
                        editingLesson && (lessonLearnerCounts[editingLesson.id] ?? 0) > 0
                          ? t("courseEdit.lessons.youtubeLockedHint")
                          : undefined
                      }
                    />
                  </Field>
                  ) : null}
                  {dialogLessonLocale === primaryContentLocale &&
                  editingLessonFormat === "video" &&
                  editingLessonYoutubeUrl.trim() ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>{t("courseEdit.lessons.segmentStartLabel")}</FieldLabel>
                        <Input
                          value={editingLessonYoutubeStartLabel}
                          onChange={(e) => setEditingLessonYoutubeStartLabel(e.target.value)}
                          placeholder={t("courseEdit.lessons.segmentStartPlaceholder")}
                          autoComplete="off"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("courseEdit.lessons.segmentEndLabel")}</FieldLabel>
                        <Input
                          value={editingLessonYoutubeEndLabel}
                          onChange={(e) => setEditingLessonYoutubeEndLabel(e.target.value)}
                          placeholder={t("courseEdit.lessons.segmentEndPlaceholder")}
                          autoComplete="off"
                        />
                      </Field>
                      <p className="sm:col-span-2 text-xs text-foreground-muted">
                        {t("courseEdit.lessons.segmentHint")}
                      </p>
                    </div>
                  ) : null}
                  <Field>
                    <FieldLabel>
                      {t("courseEdit.lessons.titleLabel")}
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {dialogLessonLocale.toUpperCase()}
                      </span>
                      {editingLessonFormat === "practice" && editingPracticeSourceLessonIds.size > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-2 inline-flex items-center gap-1"
                          onClick={() =>
                            handleGeneratePracticeTitle({
                              sourceIds: editingPracticeSourceLessonIds,
                              fallbackTitle: editingLessonTitle || editingLesson?.title || "Practice",
                              locale: dialogLessonLocale,
                              onApply: setEditingLessonTitle,
                            })}
                        >
                          <Sparkles className="size-4" aria-hidden />
                          {t("courseEdit.descriptionGenerator.trigger")}
                        </Button>
                      ) : null}
                    </FieldLabel>
                    <Input
                      value={editingLessonTitle}
                      onChange={(e) => setEditingLessonTitle(e.target.value)}
                      placeholder={t("courseEdit.content.lessonTitlePlaceholder")}
                    />
                  </Field>
                  {dialogLessonLocale === primaryContentLocale &&
                  editingLessonFormat === "article" ? (
                    <Field>
                      <FieldLabel>{t("courseEdit.lessons.durationMinutesLabel")}</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        value={
                          editingLessonMinutes === "" ? "" : String(editingLessonMinutes)
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditingLessonMinutes(
                            v === "" ? "" : Math.max(0, parseInt(v, 10) || 0),
                          );
                        }}
                        placeholder={t("courseEdit.content.lessonMinutesPlaceholder")}
                      />
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.lessons.nonVideoDurationHint")}
                      </p>
                    </Field>
                  ) : null}
                  {editingLessonFormat === "video" ? (
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.videoPrimaryLocaleLabel")}</FieldLabel>
                    <select
                      value={editingLessonVideoPrimaryLocale}
                      onChange={(e) =>
                        setEditingLessonVideoPrimaryLocale(
                          normalizeCourseLocale(e.target.value),
                        )
                      }
                      className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    >
                      {(["vi", "en"] as const).map((loc) => (
                        <option key={loc} value={loc}>
                          {loc.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("courseEdit.lessons.videoPrimaryLocaleHint")}
                    </p>
                  </Field>
                  ) : null}
                  {editingLessonFormat !== "quiz" && editingLessonFormat !== "practice" ? (
                  <Field>
                    <FieldLabel>
                      <span>{t("courseEdit.lessons.shortDescriptionLabel")}</span>
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {dialogLessonLocale.toUpperCase()}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        onClick={() =>
                          handleGenerateLessonDescription({
                            targetField: "short_description",
                            lessonId: editingLesson?.id,
                            youtubeUrl: editingLessonYoutubeUrl,
                            title: editingLessonTitle || editingLesson?.title || "",
                            shortDescription: editingLessonShortDescription,
                            markdownDescription: editingLessonMarkdown,
                            locale: dialogLessonLocale,
                            onApply: setEditingLessonShortDescription,
                          })}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {t("courseEdit.descriptionGenerator.trigger")}
                      </Button>
                    </FieldLabel>
                    <Input
                      value={editingLessonShortDescription}
                      onChange={(e) => setEditingLessonShortDescription(e.target.value)}
                      placeholder={t("courseEdit.lessons.shortDescriptionPlaceholder")}
                    />
                  </Field>
                  ) : null}
                  {dialogLessonLocale === primaryContentLocale &&
                  editingLessonFormat === "practice" &&
                  editingLesson ? (
                    <Field className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                      <FieldLabel>{t("courseEdit.lessons.practiceSourceLabel")}</FieldLabel>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {getPracticeSourceLessons(
                          editingLesson.section_id,
                          editingLesson.id,
                        ).map((lesson) => (
                          <label
                            key={lesson.id}
                            className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs text-foreground-muted"
                          >
                            <input
                              type="checkbox"
                              checked={editingPracticeSourceLessonIds.has(lesson.id)}
                              onChange={() => toggleEditingPracticeSourceLesson(lesson.id)}
                              className="mt-0.5 shrink-0 rounded border-border accent-primary"
                            />
                            <span className="line-clamp-2">{lesson.title}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.lessons.practiceSourceHint")}
                      </p>
                    </Field>
                  ) : null}
                  {editingLessonFormat === "quiz" && editingLesson ? (
                    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("courseEdit.lessons.quizSetupTitle")}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-foreground-muted">
                            {t("courseEdit.lessons.quizSetupHint")}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => openLessonQuizGenerator(editingLesson)}
                        >
                          <CheckSquare className="size-4" aria-hidden />
                          {t("courseEdit.lessons.lessonQuestions")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {editingLessonFormat !== "quiz" ? (
                  <Field>
                    <FieldLabel>
                      <span>
                        {t(
                          editingLessonFormat === "practice"
                            ? "courseEdit.lessons.practiceMarkdownLabel"
                            : "courseEdit.lessons.markdownLabel",
                        )}
                      </span>
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {dialogLessonLocale.toUpperCase()}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        onClick={() =>
                          handleGenerateLessonDescription({
                            targetField: "description_markdown",
                            lessonId: editingLesson?.id,
                            youtubeUrl: editingLessonYoutubeUrl,
                            title: editingLessonTitle || editingLesson?.title || "",
                            shortDescription: editingLessonShortDescription,
                            markdownDescription: editingLessonMarkdown,
                            sourceInputs:
                              editingLessonFormat === "practice" && editingPracticeSourceLessonIds.size > 0
                                ? getLessonSourceInputs(editingPracticeSourceLessonIds)
                                : undefined,
                            sourcePreviews:
                              editingLessonFormat === "practice" && editingPracticeSourceLessonIds.size > 0
                                ? getLessonSourcePreviews(editingPracticeSourceLessonIds)
                                : undefined,
                            locale: dialogLessonLocale,
                            onApply: setEditingLessonMarkdown,
                          })}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {t("courseEdit.descriptionGenerator.trigger")}
                      </Button>
                    </FieldLabel>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t(
                        editingLessonFormat === "practice"
                          ? "courseEdit.lessons.practiceMarkdownHint"
                          : "courseEdit.lessons.markdownHint",
                      )}
                    </p>
                    <textarea
                      value={editingLessonMarkdown}
                      onChange={(e) => setEditingLessonMarkdown(e.target.value)}
                      className="min-h-[220px] w-full rounded border border-border bg-surface-base px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      rows={10}
                    />
                  </Field>
                  ) : null}
                  {editingLessonFormat !== "quiz" && editingLessonFormat !== "practice" ? (
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
                  ) : null}
                </div>
                {editingLessonFormat !== "quiz" ? (
                <div className="space-y-4 md:sticky md:top-4 md:self-start">
                  <div className="rounded-md border border-border-subtle bg-surface-raised p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      {t("courseEdit.lessons.previewTitle")}
                    </p>
                    {editingLessonShortDescription.trim() ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground-muted">
                        {editingLessonShortDescription.trim()}
                      </p>
                    ) : null}
                    {editingLessonMarkdown.trim() ? (
                      <div className="mt-3">
                        <Markdown content={editingLessonMarkdown} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-foreground-muted">
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
                        <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
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
                ) : null}
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 z-10 border-t border-border-subtle bg-surface-float/95 p-4 backdrop-blur">
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
            open={longVideoSplitOpen}
            onOpenChange={(open) => {
              if (!open) handleCancelLongVideoSplit();
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {longVideoSplitPayload?.replaceContext
                    ? t("courseEdit.longVideo.editReplaceTitle")
                    : t("courseEdit.longVideo.title")}
                </DialogTitle>
                <DialogDescription>
                  {longVideoSplitPayload
                    ? longVideoSplitPayload.replaceContext
                      ? t("courseEdit.longVideo.editReplaceIntro", {
                          duration: formatHumanVideoDuration(
                            longVideoSplitPayload.videoDurationSeconds,
                          ),
                        })
                      : t("courseEdit.longVideo.intro", {
                          duration: formatHumanVideoDuration(
                            longVideoSplitPayload.videoDurationSeconds,
                          ),
                        })
                    : null}
                </DialogDescription>
              </DialogHeader>
              {longVideoSplitPayload ? (
                <div className="space-y-4">
                  {longVideoSplitUiMode === "choose" ? (
                    <>
                      {longVideoSplitPayload.autoSegments.length >= 2 ? (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {t("courseEdit.longVideo.foundChapters")}
                          </p>
                          <ul className="max-h-40 overflow-y-auto rounded-md border border-border-subtle p-2 text-sm">
                            {longVideoSplitPayload.chapterStarts.map((ch, idx) => (
                              <li key={`${ch.startSeconds}-${idx}`} className="py-0.5">
                                <span className="font-mono text-foreground-muted">
                                  {formatSecondsToTimestamp(ch.startSeconds)}
                                </span>{" "}
                                {ch.title || t("courseEdit.defaults.lessonTitle")}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-sm text-foreground-muted">
                          {t("courseEdit.longVideo.noChapters")}
                        </p>
                      )}
                      <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCancelLongVideoSplit()}
                          disabled={addingLessonInProgress}
                        >
                          {t("courseEdit.longVideo.dismiss")}
                        </Button>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={addingLessonInProgress}
                            onClick={() => setLongVideoSplitUiMode("manual")}
                          >
                            {t("courseEdit.longVideo.manualSplit")}
                          </Button>
                          <Button
                            type="button"
                            disabled={
                              addingLessonInProgress ||
                              longVideoSplitPayload.autoSegments.length < 2
                            }
                            onClick={() => void handleConfirmLongVideoAutoSplit()}
                          >
                            {t("courseEdit.longVideo.autoSplit")}
                          </Button>
                          <Button
                            type="button"
                            disabled={addingLessonInProgress}
                            onClick={() => void handleConfirmLongVideoKeepSingle()}
                          >
                            {t("courseEdit.longVideo.keepSingle")}
                          </Button>
                        </div>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{t("courseEdit.longVideo.manualTitle")}</p>
                        {longVideoSplitPayload.autoSegments.length >= 2 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={addingLessonInProgress}
                            onClick={() => setLongVideoSplitUiMode("choose")}
                          >
                            {t("courseEdit.longVideo.back")}
                          </Button>
                        ) : null}
                      </div>
                      <div className="space-y-3">
                        {manualSegmentRows.map((row, idx) => (
                          <div
                            key={`manual-${idx}`}
                            className="grid gap-2 rounded-md border border-border-subtle p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
                          >
                            <Input
                              value={row.start}
                              placeholder={t("courseEdit.longVideo.manualStartPlaceholder")}
                              onChange={(e) =>
                                setManualSegmentRows((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], start: e.target.value };
                                  return next;
                                })
                              }
                            />
                            <Input
                              value={row.end}
                              placeholder={t("courseEdit.longVideo.manualEndPlaceholder")}
                              onChange={(e) =>
                                setManualSegmentRows((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], end: e.target.value };
                                  return next;
                                })
                              }
                            />
                            <Input
                              value={row.title}
                              placeholder={t("courseEdit.content.lessonTitlePlaceholder")}
                              onChange={(e) =>
                                setManualSegmentRows((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], title: e.target.value };
                                  return next;
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0"
                              disabled={manualSegmentRows.length <= 1 || addingLessonInProgress}
                              onClick={() =>
                                setManualSegmentRows((prev) => prev.filter((_, i) => i !== idx))
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
                        disabled={addingLessonInProgress}
                        onClick={() =>
                          setManualSegmentRows((prev) => [
                            ...prev,
                            { start: "", end: "", title: "" },
                          ])
                        }
                      >
                        <Plus className="mr-1 size-4" aria-hidden />
                        {t("courseEdit.longVideo.manualAddRow")}
                      </Button>
                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={addingLessonInProgress}
                          onClick={() =>
                            longVideoSplitPayload.autoSegments.length >= 2
                              ? setLongVideoSplitUiMode("choose")
                              : handleCancelLongVideoSplit()
                          }
                        >
                          {longVideoSplitPayload.autoSegments.length >= 2
                            ? t("courseEdit.longVideo.back")
                            : t("courseEdit.longVideo.dismiss")}
                        </Button>
                        <Button
                          type="button"
                          disabled={addingLessonInProgress}
                          onClick={() => void handleConfirmLongVideoManualSplit()}
                        >
                          {t("courseEdit.longVideo.manualConfirm")}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            open={addingLessonDraftSectionId != null}
            onOpenChange={(open) => !open && setAddingLessonDraftSectionId(null)}
          >
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-0">
              <div className="flex max-h-[85vh] flex-col">
                <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-surface-float/95 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle>{t("courseEdit.lessons.createTitle")}</DialogTitle>
                    <span className="rounded bg-surface-raised px-2 py-1 text-xs font-semibold text-foreground">
                      {activeContentLocale.toUpperCase()}
                    </span>
                  </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <div
                    className={cn(
                      "grid gap-6",
                      newLessonFormat !== "quiz" &&
                        "md:grid-cols-[minmax(0,1fr)_360px]",
                    )}
                  >
                <div className="space-y-4 md:pr-2">
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.formatLabel")}</FieldLabel>
                    <LessonFormatSelector
                      value={newLessonFormat}
                      onChange={(next) => {
                        setNewLessonFormat(next);
                        if (next !== "video") setNewLessonYoutubeUrl("");
                        if (next === "quiz") {
                          setNewLessonShortDescription("");
                          setNewLessonMarkdown("");
                          setNewLessonMinutes("");
                          setNewLessonResources([]);
                          seedNewQuizSourceLessons(addingLessonDraftSectionId);
                          setNewQuizQuestions((prev) =>
                            prev.length > 0 ? prev : [makeBlankNewQuizQuestion()],
                          );
                        } else if (next === "practice") {
                          setNewLessonShortDescription("");
                          setNewLessonMinutes("");
                          setNewLessonResources([]);
                          seedNewPracticeSourceLessons(addingLessonDraftSectionId);
                        }
                      }}
                      videoLabel={t("courseEdit.lessons.formatVideo")}
                      articleLabel={t("courseEdit.lessons.formatArticle")}
                      quizLabel={t("courseEdit.lessons.formatQuiz")}
                      practiceLabel={t("courseEdit.lessons.formatPractice")}
                      hint={t("courseEdit.lessons.formatHint")}
                    />
                  </Field>
                  {newLessonFormat === "video" ? (
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.youtubeLabel")}</FieldLabel>
                    <Input
                      value={newLessonYoutubeUrl}
                      onChange={(e) => setNewLessonYoutubeUrl(e.target.value)}
                      placeholder={t("courseEdit.lessons.youtubePlaceholder")}
                    />
                  </Field>
                  ) : null}
                  {newLessonFormat === "video" ? (
                  <Field>
                    <FieldLabel>{t("courseEdit.lessons.videoPrimaryLocaleLabel")}</FieldLabel>
                    <select
                      value={defaultVideoPrimaryLocale}
                      onChange={(e) =>
                        setDefaultVideoPrimaryLocale(normalizeCourseLocale(e.target.value))
                      }
                      className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    >
                      {(["vi", "en"] as const).map((loc) => (
                        <option key={loc} value={loc}>
                          {loc.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("courseEdit.lessons.videoPrimaryLocaleHint")}
                    </p>
                  </Field>
                  ) : null}
                  <Field>
                    <FieldLabel>
                      {t("courseEdit.lessons.titleLabel")}
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {activeContentLocale.toUpperCase()}
                      </span>
                      {newLessonFormat === "practice" && newPracticeSourceLessonIds.size > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-2 inline-flex items-center gap-1"
                          onClick={() =>
                            handleGeneratePracticeTitle({
                              sourceIds: newPracticeSourceLessonIds,
                              fallbackTitle:
                                newLessonTitle ||
                                (addingLessonDraftSectionId
                                  ? getDefaultActivityLessonTitle(
                                      addingLessonDraftSectionId,
                                      "practice",
                                    )
                                  : "Practice"),
                              locale: activeContentLocale,
                              onApply: setNewLessonTitle,
                            })}
                        >
                          <Sparkles className="size-4" aria-hidden />
                          {t("courseEdit.descriptionGenerator.trigger")}
                        </Button>
                      ) : null}
                    </FieldLabel>
                    <Input
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      placeholder={t("courseEdit.content.lessonTitlePlaceholder")}
                    />
                  </Field>
                  {newLessonFormat !== "quiz" && newLessonFormat !== "practice" ? (
                  <Field>
                    <FieldLabel>
                      <span>{t("courseEdit.lessons.shortDescriptionLabel")}</span>
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {activeContentLocale.toUpperCase()}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        onClick={() =>
                          handleGenerateLessonDescription({
                            targetField: "short_description",
                            youtubeUrl: newLessonYoutubeUrl,
                            title: newLessonTitle,
                            shortDescription: newLessonShortDescription,
                            markdownDescription: newLessonMarkdown,
                            locale: activeContentLocale,
                            onApply: setNewLessonShortDescription,
                          })}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {t("courseEdit.descriptionGenerator.trigger")}
                      </Button>
                    </FieldLabel>
                    <Input
                      value={newLessonShortDescription}
                      onChange={(e) => setNewLessonShortDescription(e.target.value)}
                      placeholder={t("courseEdit.lessons.shortDescriptionPlaceholder")}
                    />
                  </Field>
                  ) : null}
                  {newLessonFormat === "video" ? (
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
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("courseEdit.lessons.durationHint")}
                    </p>
                  </Field>
                  ) : null}
                  {form.access_model === "paid_upfront" && newLessonFormat !== "quiz" && (
                    <label className="inline-flex items-center gap-2 text-xs text-foreground-muted">
                      <input
                        type="checkbox"
                        checked={newLessonIsPreviewFree}
                        onChange={(e) => setNewLessonIsPreviewFree(e.target.checked)}
                        className="rounded border-border"
                      />
                      {t("courseEdit.lessons.previewFreeLabel")}
                    </label>
                  )}
                  {newLessonFormat === "quiz" ? (
                    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-raised p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("courseEdit.lessons.quizSetupTitle")}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-foreground-muted">
                            {t("courseEdit.lessons.quizCreateHint")}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() =>
                            setNewQuizQuestions((prev) => [
                              ...prev,
                              makeBlankNewQuizQuestion(),
                            ])
                          }
                        >
                          <Plus className="size-4" aria-hidden />
                          {t("courseEdit.questions.add")}
                        </Button>
                      </div>
                      {getNewQuizSourceLessons().length > 0 ? (
                        <div className="grid gap-4 rounded-lg border border-border-subtle bg-surface-base p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                              {t("courseEdit.questions.sourceLessons")}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {getNewQuizSourceLessons().map((lesson) => (
                                <label
                                  key={lesson.id}
                                  className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-foreground-muted"
                                >
                                  <input
                                    type="checkbox"
                                    checked={newQuizSourceLessonIds.has(lesson.id)}
                                    onChange={() => toggleNewQuizSourceLesson(lesson.id)}
                                    className="mt-0.5 shrink-0 rounded border-border accent-primary"
                                  />
                                  <span className="line-clamp-2">{lesson.title}</span>
                                </label>
                              ))}
                            </div>
                            {newQuizGeneratedSources.length > 0 ? (
                              <p className="text-xs text-foreground-muted">
                                {t("courseEdit.questions.sources")}:{" "}
                                {newQuizGeneratedSources
                                  .map((source) => source.lessonTitle)
                                  .join(", ")}
                              </p>
                            ) : null}
                            {newQuizGenerateError ? (
                              <p className="text-xs text-destructive">
                                {newQuizGenerateError}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <select
                              value={newQuizQuestionCount}
                              onChange={(e) =>
                                setNewQuizQuestionCount(parseInt(e.target.value, 10) || 5)
                              }
                              className="h-9 rounded border border-border bg-surface-base px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                              aria-label={t("courseEdit.questions.count")}
                            >
                              {NEW_QUIZ_COUNT_OPTIONS.map((count) => (
                                <option key={count} value={count}>
                                  {count}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                newQuizGenerating || newQuizSourceLessonIds.size === 0
                              }
                              onClick={() => void handleGenerateNewQuizQuestions()}
                            >
                              {newQuizGenerating ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Sparkles className="size-4" aria-hidden />
                              )}
                              {newQuizGenerating
                                ? t("courseEdit.questions.generating")
                                : t("courseEdit.questions.generate")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {newQuizQuestions.length > 0 ? (
                        <div className="space-y-3">
                          {newQuizQuestions.map((question, questionIndex) => (
                            <div
                              key={question._key}
                              className="space-y-3 rounded-lg border border-border-subtle bg-surface-base p-3"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-2 shrink-0 rounded border border-border-subtle px-2 py-0.5 text-xs font-medium text-foreground-muted">
                                  {questionIndex + 1}
                                </span>
                                <textarea
                                  value={question.question}
                                  onChange={(e) =>
                                    updateNewQuizQuestion(questionIndex, (prev) => ({
                                      ...prev,
                                      question: e.target.value,
                                    }))
                                  }
                                  rows={2}
                                  placeholder={t("courseEdit.questions.questionPlaceholder")}
                                  className="min-h-[68px] w-full resize-none rounded border border-border bg-surface-base px-3 py-2 text-sm leading-5 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="mt-1 shrink-0 text-destructive"
                                  onClick={() =>
                                    setNewQuizQuestions((prev) =>
                                      prev.filter((_, i) => i !== questionIndex),
                                    )
                                  }
                                  aria-label={t("courseEdit.questions.remove")}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {question.options.map((option, optionIndex) => (
                                  <div key={option.id} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`new-quiz-correct-${question._key}`}
                                      checked={question.correct_index === optionIndex}
                                      onChange={() =>
                                        updateNewQuizQuestion(questionIndex, (prev) => ({
                                          ...prev,
                                          correct_index: optionIndex,
                                        }))
                                      }
                                      className="shrink-0 accent-primary"
                                      aria-label={t("courseEdit.questions.correctAnswer", {
                                        option: option.id.toUpperCase(),
                                      })}
                                    />
                                    <span className="w-5 shrink-0 text-xs font-medium uppercase text-foreground-muted">
                                      {option.id}
                                    </span>
                                    <Input
                                      value={option.text}
                                      onChange={(e) =>
                                        updateNewQuizQuestionOption(
                                          questionIndex,
                                          optionIndex,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={t("courseEdit.questions.optionPlaceholder", {
                                        option: option.id.toUpperCase(),
                                      })}
                                      className="h-9 flex-1 text-sm"
                                    />
                                  </div>
                                ))}
                              </div>
                              <Input
                                value={question.explanation ?? ""}
                                onChange={(e) =>
                                  updateNewQuizQuestion(questionIndex, (prev) => ({
                                    ...prev,
                                    explanation: e.target.value,
                                  }))
                                }
                                placeholder={t("courseEdit.questions.explanationPlaceholder")}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed border-border-subtle px-3 py-4 text-center text-sm text-foreground-muted">
                          {t("courseEdit.questions.emptyInline")}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {newLessonFormat === "practice" ? (
                    <Field className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                      <FieldLabel>{t("courseEdit.lessons.practiceSourceLabel")}</FieldLabel>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {getPracticeSourceLessons(addingLessonDraftSectionId).map((lesson) => (
                          <label
                            key={lesson.id}
                            className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs text-foreground-muted"
                          >
                            <input
                              type="checkbox"
                              checked={newPracticeSourceLessonIds.has(lesson.id)}
                              onChange={() => toggleNewPracticeSourceLesson(lesson.id)}
                              className="mt-0.5 shrink-0 rounded border-border accent-primary"
                            />
                            <span className="line-clamp-2">{lesson.title}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {t("courseEdit.lessons.practiceSourceHint")}
                      </p>
                    </Field>
                  ) : null}
                  {newLessonFormat !== "quiz" ? (
                  <Field>
                    <FieldLabel>
                      <span>
                        {t(
                          newLessonFormat === "practice"
                            ? "courseEdit.lessons.practiceMarkdownLabel"
                            : "courseEdit.lessons.markdownLabel",
                        )}
                      </span>
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {activeContentLocale.toUpperCase()}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-2 inline-flex items-center gap-1"
                        onClick={() =>
                          handleGenerateLessonDescription({
                            targetField: "description_markdown",
                            youtubeUrl: newLessonYoutubeUrl,
                            title: newLessonTitle,
                            shortDescription: newLessonShortDescription,
                            markdownDescription: newLessonMarkdown,
                            sourceInputs:
                              newLessonFormat === "practice" && newPracticeSourceLessonIds.size > 0
                                ? getLessonSourceInputs(newPracticeSourceLessonIds)
                                : undefined,
                            sourcePreviews:
                              newLessonFormat === "practice" && newPracticeSourceLessonIds.size > 0
                                ? getLessonSourcePreviews(newPracticeSourceLessonIds)
                                : undefined,
                            locale: activeContentLocale,
                            onApply: setNewLessonMarkdown,
                          })}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {t("courseEdit.descriptionGenerator.trigger")}
                      </Button>
                    </FieldLabel>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t(
                        newLessonFormat === "practice"
                          ? "courseEdit.lessons.practiceMarkdownHint"
                          : "courseEdit.lessons.markdownHint",
                      )}
                    </p>
                    <textarea
                      value={newLessonMarkdown}
                      onChange={(e) => setNewLessonMarkdown(e.target.value)}
                      className="min-h-[220px] w-full rounded border border-border bg-surface-base px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      rows={10}
                    />
                  </Field>
                  ) : null}
                  {newLessonFormat !== "quiz" && newLessonFormat !== "practice" ? (
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
                  ) : null}
                </div>
                {newLessonFormat !== "quiz" ? (
                <div className="space-y-4 md:sticky md:top-4 md:self-start">
                  <div className="rounded-md border border-border-subtle bg-surface-raised p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      {t("courseEdit.lessons.previewTitle")}
                    </p>
                    {newLessonShortDescription.trim() ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground-muted">
                        {newLessonShortDescription.trim()}
                      </p>
                    ) : null}
                    {newLessonMarkdown.trim() ? (
                      <div className="mt-3">
                        <Markdown content={newLessonMarkdown} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-foreground-muted">
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
                        <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
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
                ) : null}
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 z-10 border-t border-border-subtle bg-surface-float/95 p-4 backdrop-blur">
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
            <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
                  <FileText className="size-5" aria-hidden /> {t("courseEdit.sidebar.nav.assignments")}
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {activeContentLocale !== primaryContentLocale ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="inline-flex items-center gap-1.5"
                      disabled={
                        translatingBundle === "assignment" ||
                        !bundleHasSource({
                          title: course.final_assignment_title ?? "",
                          description: course.final_assignment_description ?? "",
                          instructions: course.final_assignment_instructions ?? "",
                        })
                      }
                      onClick={handleTranslateAssignmentBundle}
                    >
                      {translatingBundle === "assignment" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="size-4" aria-hidden />
                      )}
                      {translatingBundle === "assignment"
                        ? t("courseEdit.descriptionGenerator.translating")
                        : t("courseEdit.descriptionGenerator.translateTrigger")}
                    </Button>
                  ) : null}
                  <span className="rounded bg-surface-raised px-2 py-1 text-xs font-semibold text-foreground">
                    {activeContentLocale.toUpperCase()}
                  </span>
                </div>
              </div>
              {form.access_model === "free_with_paid_certificate" && (
                <p className="mb-3 text-sm text-primary">
                  Học viên cần thanh toán{" "}
                  {formatVndPrice(Number(form.certificate_fee_vnd || 0))} để mở
                  quyền nộp bài thu hoạch và xét chứng nhận (cổng thanh toán sẽ
                  tích hợp sau).
                </p>
              )}
              <p className="mb-4 text-sm text-foreground-muted">
                Nếu có, học viên phải nộp và được duyệt mới đủ điều kiện nhận
                chứng nhận.
              </p>

              <div className="mb-8 rounded-md border border-border-subtle bg-surface-raised p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {t("courseEdit.assignments.settingsTitle")}
                </h3>
                <FieldGroup>
                  <div
                    ref={(node) => {
                      courseFieldRefs.current.final_assignment_title = node;
                    }}
                  >
                  <Field>
                    <FieldLabel>
                      {t("courseEdit.assignments.titleLabel")}
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {activeContentLocale.toUpperCase()}
                      </span>
                    </FieldLabel>
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
                  </div>
                  <div
                    ref={(node) => {
                      courseFieldRefs.current.final_assignment_description = node;
                    }}
                  >
                  <Field>
                    <FieldLabel>
                      {t("courseEdit.assignments.descriptionLabel")}
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {activeContentLocale.toUpperCase()}
                      </span>
                    </FieldLabel>
                    <textarea
                      placeholder={t("courseEdit.assignments.descriptionPlaceholder")}
                    value={contentForm.final_assignment_description}
                      onChange={(e) =>
                      setContentForm((p) => ({
                          ...p,
                          final_assignment_description: e.target.value,
                        }))
                      }
                      className="min-h-[80px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      rows={3}
                    />
                  </Field>
                  </div>
                  <div
                    ref={(node) => {
                      courseFieldRefs.current.final_assignment_instructions = node;
                    }}
                  >
                  <Field>
                    <FieldLabel>
                      {t("courseEdit.assignments.instructionsLabel")}
                      <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                        {activeContentLocale.toUpperCase()}
                      </span>
                    </FieldLabel>
                    <textarea
                      placeholder={t("courseEdit.assignments.instructionsPlaceholder")}
                    value={contentForm.final_assignment_instructions}
                      onChange={(e) =>
                      setContentForm((p) => ({
                          ...p,
                          final_assignment_instructions: e.target.value,
                        }))
                      }
                      className="min-h-[60px] w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      rows={2}
                    />
                  </Field>
                  </div>
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
                {t("courseEdit.assignments.submissionsTitle")}
              </h3>
              {(contentForm.final_assignment_title || course.final_assignment_title) ? (
                <>
                  {submissions.length === 0 ? (
                    <p className="text-sm text-foreground-muted py-4">
                      {t("courseEdit.assignments.noSubmissions")}
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border-subtle">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border-subtle bg-surface-raised">
                            <th className="px-4 py-3 font-medium text-foreground">
                              {t("courseEdit.assignments.columns.student")}
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground">
                              {t("courseEdit.assignments.columns.content")}
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground">
                              {t("courseEdit.assignments.columns.submittedAt")}
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground">
                              {t("courseEdit.assignments.columns.status")}
                            </th>
                            <th className="px-4 py-3 font-medium text-foreground w-40">
                              {t("courseEdit.assignments.columns.actions")}
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
                                className="border-b border-border-subtle last:border-b-0 hover:bg-surface-raised"
                              >
                                <td className="px-4 py-3">
                                  <div>
                                    <span className="font-medium text-foreground">
                                      {profile?.full_name || "—"}
                                    </span>
                                    <span className="block text-xs text-foreground-muted">
                                      {t("courseEdit.assignments.lessonProgress" as never, { progress: prog })}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 max-w-[200px]">
                                  <p className="line-clamp-2 text-foreground-muted">
                                    {sub.content || "—"}
                                  </p>
                                  {sub.file_urls?.length ? (
                                    <span className="text-xs text-foreground-muted">
                                      {t("courseEdit.assignments.attachments" as never, { count: sub.file_urls.length })}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-foreground-muted">
                                  {new Date(
                                    sub.submitted_at,
                                  ).toLocaleDateString(intlLocale())}
                                </td>
                                <td className="px-4 py-3">
                                  {sub.status === "approved" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                      <CheckCircle2 className="size-3.5" aria-hidden /> {t("courseEdit.students.status.approved")}
                                    </span>
                                  ) : sub.status === "rejected" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                                      <XCircle className="size-3.5" /> {t("courseEdit.students.status.rejected")}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                                      {t("courseEdit.students.status.pending")}
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
                                        {t("courseEdit.assignments.reviewReject")}
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
                <p className="text-sm text-foreground-muted">
                  {t("courseEdit.assignments.noSubmissionsHint")}
                </p>
              )}
            </section>
          )}

          {activeSection === "certificate" && canAccessCertificate && (
            <div className="space-y-4">
              {/* Card 1: PDF Certificate template */}
              <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-1">
                  <Award className="size-5" aria-hidden /> {t("courseEdit.certificate.sectionTitle")}
                </h2>
                <p className="mb-6 text-sm text-foreground-muted">
                  {t("courseEdit.certificate.sectionDescription")}
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
                          {t("courseEdit.certificate.viewCurrentTemplate")}
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

                <div className="rounded-md border border-border-subtle bg-surface-raised p-4">
                  <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <FileText className="size-4" /> {t("courseEdit.certificateGuide.title")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-foreground-muted">
                    <li>{t("courseEdit.certificateGuide.sizeHint")}</li>
                    <li>{t("courseEdit.certificateGuide.nameAreaHint")}</li>
                    <li>{t("courseEdit.certificateGuide.afterUploadHint")}</li>
                    <li>{t("courseEdit.certificate.fileFormatHint")}</li>
                  </ul>
                  <div className="mt-4">
                    <a
                      href="/certificate-template-sample.svg"
                      download="certificate-template-sample.svg"
                      className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-base shadow-card px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-raised"
                    >
                      <Download className="size-4" aria-hidden /> {t("courseEdit.certificateGuide.downloadSample")}
                    </a>
                  </div>
                </div>
              </section>

              {/* Card 2: Open Campus On-chain Credential */}
              {id && canManageCourseOcb && (
                <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
                  <CourseOcbCredentialSection
                    courseId={id}
                    courseSlug={(form.slug || course.slug || "").trim()}
                    canEdit={canManageCourseOcb}
                    hasCertificate={form.has_certificate ?? false}
                    onActiveChange={setOcbIsActive}
                    certificateTemplateUrl={course.certificate_template_url ?? null}
                  />
                </section>
              )}
            </div>
          )}

          {activeSection === "announcements" && canAccessAnnouncements && (
            <AnnouncementsSection
              courseId={id ?? ""}
              enrollmentCount={enrollments.length}
            />
          )}

          {activeSection === "students" && canAccessStudents && (
            <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-4">
                <Users className="size-5" /> {t("courseEdit.sidebar.nav.students")}
              </h2>
              {enrollments.length === 0 ? (
                <p className="text-sm text-foreground-muted py-4">
                  {t("courseEdit.students.empty")}
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border-subtle">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-raised">
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.student")}
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          Email
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.progress")}
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.assignment")}
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.certificate")}
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.payment")}
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.enrolledAt")}
                        </th>
                        <th className="px-4 py-3 font-medium text-foreground">
                          {t("courseEdit.students.columns.lastAccess")}
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
                            className="border-b border-border-subtle last:border-b-0 hover:bg-surface-raised"
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
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-foreground-muted text-xs font-medium">
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
                            <td className="px-4 py-3 text-foreground-muted">
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
                                      {t("courseEdit.students.status.approved")}
                                    </span>
                                  ) : sub.status === "rejected" ? (
                                    <span className="text-destructive text-xs">
                                      {t("courseEdit.students.status.rejected")}
                                    </span>
                                  ) : (
                                    <span className="text-warning text-xs">
                                      {t("courseEdit.students.status.pending")}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-foreground-muted text-xs">
                                    {t("courseEdit.students.status.notSubmitted")}
                                  </span>
                                )
                              ) : (
                                <span className="text-foreground-muted text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!course.has_certificate ? (
                                <span className="text-foreground-muted text-xs">—</span>
                              ) : hasCert ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                                  <CheckCircle2 className="size-3.5" aria-hidden /> {t("courseEdit.students.status.issued")}
                                </span>
                              ) : prog >= 100 && (!course.final_assignment_title || sub?.status === "approved") ? (
                                <button
                                  type="button"
                                  disabled={issuingCertForUser === e.user_id}
                                  onClick={() => void handleIssueCertificateForUser(e.user_id)}
                                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                                >
                                  {issuingCertForUser === e.user_id ? "…" : t("courseEdit.students.status.issue")}
                                </button>
                              ) : (
                                <span className="text-foreground-muted text-xs">
                                  {t("courseEdit.students.status.notEligible")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isPaid ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs font-medium text-foreground">
                                    {t("courseEdit.students.status.paid")} ·{" "}
                                    {formatVndPrice(e.paid_amount_vnd)}
                                  </div>
                                  <div className="text-xs text-foreground-muted">
                                    {e.paid_provider
                                      ? t("courseEdit.students.providerLabel", {
                                          provider: e.paid_provider,
                                        })
                                      : t("courseEdit.students.providerEmpty")}
                                    {e.paid_order_id
                                      ? ` · ${t("courseEdit.students.orderLabel", { id: e.paid_order_id })}`
                                      : ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-foreground-muted">
                                  {t("courseEdit.students.status.free")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-foreground-muted">
                              {e.enrolled_at
                                ? new Date(e.enrolled_at).toLocaleDateString(intlLocale())
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-foreground-muted">
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
            <section className="rounded-md border border-destructive/30 bg-surface-base p-6">
              <h2 className="text-lg font-medium text-foreground flex items-center gap-2 mb-2">
                <AlertTriangle className="size-5" aria-hidden /> {t("courseEdit.danger.dangerZoneTitle")}
              </h2>
              <p className="text-sm text-foreground-muted mb-4">
                {t("courseEdit.danger.deleteWarning")}
              </p>
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      type="button"
                    >
                      <Trash2 className="size-4" aria-hidden /> {t("courseEdit.sidebar.nav.danger")}
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("courseEdit.danger.deleteCourseTitle")}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-foreground-muted">
                    {t("courseEdit.danger.deleteConfirmWarning")}
                  </p>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => void handleDeleteCourse()}
                    >
                      {t("courseEdit.danger.deleteButton")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          )}
        </div>
      </div>
      <DescriptionGeneratorDialog
        open={descriptionGeneratorOpen}
        request={descriptionGeneratorRequest}
        onOpenChange={(open) => {
          setDescriptionGeneratorOpen(open);
          if (!open) setDescriptionGeneratorRequest(null);
        }}
        t={(key, options) => String(t(key as never, options as never))}
      />
      <QuestionGeneratorDialog
        open={questionGeneratorOpen}
        section={questionGeneratorSection}
        courseId={id ?? ""}
        locale={activeContentLocale}
        onOpenChange={(open) => {
          setQuestionGeneratorOpen(open);
          if (!open) setQuestionGeneratorSection(null);
        }}
      />
      <QuestionGeneratorDialog
        open={lessonQuizDialogOpen}
        section={null}
        courseId={id ?? ""}
        locale={activeContentLocale}
        mode="lesson"
        lessonId={lessonQuizDialogLesson?.id}
        lessonTitle={lessonQuizDialogLesson?.title}
        sectionLessons={lessonQuizDialogSectionLessons}
        onOpenChange={(open) => {
          setLessonQuizDialogOpen(open);
          if (!open) setLessonQuizDialogLesson(null);
        }}
      />
    </PageContainer>
  );
};

export default InstructorCourseEdit;
