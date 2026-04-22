import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import { createOfflineCohort, createOfflineCourse } from "@/lib/offline";
import { listCoreliaInstructorProfiles } from "@/lib/profile";
import type { Profile } from "@/types/database";
import type {
  OfflineCohortStatus,
  OfflineDeliveryMode,
  OfflineMeetingProvider,
} from "@/types/offline";

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export default function CohortNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<OfflineCohortStatus>("draft");
  const [deliveryMode, setDeliveryMode] = useState<OfflineDeliveryMode>("offline");
  const [meetingProvider, setMeetingProvider] = useState<OfflineMeetingProvider>("google_meet");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("");
  const [courseInstructorIds, setCourseInstructorIds] = useState<string[]>([]);
  const [cohortInstructorId, setCohortInstructorId] = useState("");
  const [zoomHostEmail, setZoomHostEmail] = useState("");
  const [defaultZoomJoinUrl, setDefaultZoomJoinUrl] = useState("");
  const [defaultZoomStartUrl, setDefaultZoomStartUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationNotes, setRegistrationNotes] = useState("");
  const [certificateTitle, setCertificateTitle] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [instructorOptions, setInstructorOptions] = useState<Profile[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingInstructors(true);
    void listCoreliaInstructorProfiles()
      .then((rows) => {
        if (!active) return;
        setInstructorOptions(rows);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Không thể tải danh sách giảng viên.");
      })
      .finally(() => {
        if (active) setLoadingInstructors(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const instructorPickerOptions = useMemo(
    () =>
      instructorOptions.map((item) => ({
        id: item.id,
        label: item.full_name || item.email || item.id,
        description: item.email || item.instructor_organization || item.id,
      })),
    [instructorOptions],
  );
  const selectedCohortInstructor = useMemo(
    () => instructorOptions.find((item) => item.id === cohortInstructorId) ?? null,
    [cohortInstructorId, instructorOptions],
  );
  const selectedCourseInstructorNames = useMemo(
    () =>
      courseInstructorIds
        .map((id) => {
          const profile = instructorOptions.find((item) => item.id === id);
          return profile?.full_name || profile?.email || profile?.id;
        })
        .filter(Boolean) as string[],
    [courseInstructorIds, instructorOptions],
  );

  const canSubmit = useMemo(
    () =>
      title.trim().length >= 3 &&
      tagline.trim().length >= 12 &&
      cohortInstructorId.trim().length >= 3 &&
      courseInstructorIds.length > 0,
    [cohortInstructorId, courseInstructorIds.length, tagline, title],
  );

  useEffect(() => {
    if (!cohortInstructorId) return;
    setCourseInstructorIds((prev) =>
      prev.includes(cohortInstructorId) ? prev : [...prev, cohortInstructorId],
    );
    if (!zoomHostEmail.trim()) {
      setZoomHostEmail(selectedCohortInstructor?.email ?? "");
    }
  }, [cohortInstructorId, selectedCohortInstructor?.email, zoomHostEmail]);

  async function handleCreate() {
    if (!canSubmit || submitting) return;
    if (!selectedCohortInstructor) {
      toast.error("Hãy chọn giảng viên đứng lớp cho cohort đầu tiên.");
      return;
    }
    setSubmitting(true);
    try {
      const course = await createOfflineCourse({
        title,
        tagline,
        description,
        venue_city: city,
        instructor_ids: courseInstructorIds,
        instructor_names: selectedCourseInstructorNames,
        certificate_title: certificateTitle,
        price_note: priceNote,
        published: status !== "draft",
      });
      await createOfflineCohort({
        offline_course_id: course.id,
        title: `${title} · Cohort 1`,
        tagline,
        description,
        status,
        delivery_mode: deliveryMode,
        meeting_provider: meetingProvider,
        venue_name: venueName,
        venue_address: venueAddress,
        city,
        instructor_id: selectedCohortInstructor.id,
        instructor_name:
          selectedCohortInstructor.full_name ||
          selectedCohortInstructor.email ||
          selectedCohortInstructor.id,
        zoom_host_email: zoomHostEmail,
        default_zoom_join_url: defaultZoomJoinUrl,
        default_zoom_start_url: defaultZoomStartUrl,
        starts_at: toIsoOrNull(startsAt),
        ends_at: toIsoOrNull(endsAt),
        registration_notes: registrationNotes,
      });
      toast.success("Đã tạo khoá offline và cohort đầu tiên.");
      navigate(`/instructor/cohorts/${course.id}/manage`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo lớp học.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Thiết lập cohort trực tiếp
          </div>
          <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground">
            Tạo khoá học offline mới
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Khởi tạo khoá offline ở tầng sản phẩm, đồng thời tạo luôn cohort đầu tiên để
            bạn bắt đầu vận hành lịch học và recording.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            placeholder="Tên khoá học offline"
          />
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            placeholder="Tagline: mô tả ngắn về khoá học này dành cho ai"
          />
          <div className="grid gap-4 md:grid-cols-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OfflineCohortStatus)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="draft">Bản nháp</option>
              <option value="published">Mở ghi danh</option>
              <option value="running">Đang diễn ra</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as OfflineDeliveryMode)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="offline">Học trực tiếp</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <select
              value={meetingProvider}
              onChange={(e) =>
                setMeetingProvider(e.target.value as OfflineMeetingProvider)
              }
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="google_meet">Google Meet</option>
              <option value="manual">Không dùng họp online</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Giảng viên phụ trách của khoá
              </div>
              <ProfileCombobox
                title="Chọn giảng viên phụ trách"
                description="Một khoá offline có thể có nhiều giảng viên nội bộ Corelia cùng phụ trách."
                options={instructorPickerOptions}
                placeholder={
                  loadingInstructors
                    ? "Đang tải danh sách giảng viên..."
                    : "Chọn một hoặc nhiều giảng viên"
                }
                value={courseInstructorIds}
                onChange={(value) => setCourseInstructorIds(value as string[])}
                multiple
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Giảng viên đứng lớp cho cohort đầu tiên
              </div>
              <ProfileCombobox
                title="Chọn giảng viên cho cohort"
                description="Mỗi cohort chỉ có một giảng viên phụ trách chính để vận hành lịch học, Google Meet và recording."
                options={instructorPickerOptions}
                placeholder={
                  loadingInstructors
                    ? "Đang tải danh sách giảng viên..."
                    : "Chọn giảng viên đứng lớp"
                }
                value={cohortInstructorId}
                onChange={(value) => setCohortInstructorId(value as string)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Tên địa điểm"
            />
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Địa chỉ"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Thành phố"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={zoomHostEmail}
              onChange={(e) => setZoomHostEmail(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Email host Google Meet"
            />
            <input
              value={defaultZoomJoinUrl}
              onChange={(e) => setDefaultZoomJoinUrl(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Google Meet link cho học viên"
            />
            <input
              value={defaultZoomStartUrl}
              onChange={(e) => setDefaultZoomStartUrl(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Google Meet link cho giảng viên"
            />
            <input
              value={certificateTitle}
              onChange={(e) => setCertificateTitle(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Tên chứng nhận (nếu có)"
            />
            <input
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Ghi chú học phí / chính sách đăng ký"
            />
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="rounded-2xl border border-border-subtle bg-background p-4 text-[13px] leading-6 text-muted-foreground">
            Khi cohort dùng `Google Meet`, link ở trên sẽ được xem như kênh dự phòng
            cho học viên check-in và tham gia online nếu không thể đến lớp trực tiếp. Các
            buổi học tạo sau đó sẽ tự điền sẵn link này để đội ngũ vận hành không phải nhập
            lặp lại.
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Mô tả khoá offline, kết quả đầu ra và ngữ cảnh triển khai"
          />
          <textarea
            value={registrationNotes}
            onChange={(e) => setRegistrationNotes(e.target.value)}
            rows={4}
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Ghi chú ghi danh, quy định điểm danh, cách xem recording..."
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => navigate("/instructor/cohorts")}>
              Quay lại
            </Button>
            <Button disabled={!canSubmit || submitting} onClick={handleCreate}>
              {submitting ? "Đang tạo..." : "Tạo khoá offline"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
