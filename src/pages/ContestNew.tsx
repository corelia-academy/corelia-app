import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CalendarBlank, Gavel, ShieldCheck, Trophy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createContest } from "@/lib/contests";
import type { ContestLocation, ContestStatus } from "@/types/contests";

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export default function ContestNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [location, setLocation] = useState<ContestLocation>("hybrid");
  const [status, setStatus] = useState<ContestStatus>("draft");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && tagline.trim().length >= 8;
  }, [title, tagline]);
  const readinessItems = useMemo(
    () => [
      {
        title: "Trang công khai",
        description: "Trang cuộc thi sẽ có phần giới thiệu, mốc thời gian, thể lệ và CTA đăng ký rõ ràng.",
      },
      {
        title: "Duyệt hồ sơ",
        description: "Người của Corelia duyệt hồ sơ trước khi mở quyền submission.",
      },
      {
        title: "Luồng chấm điểm",
        description: "Ban giám khảo được mời vào khu vực vận hành để chấm theo rubric có trọng số.",
      },
    ],
    [],
  );

  async function handleCreate() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const contest = await createContest({
        title,
        tagline,
        description,
        rules,
        location,
        status,
        starts_at: toIsoOrNull(startsAt),
        ends_at: toIsoOrNull(endsAt),
        registration_deadline: toIsoOrNull(registrationDeadline),
        max_participants: maxParticipants.trim() ? Number(maxParticipants) : null,
      });
      toast.success("Đã tạo cuộc thi.");
      navigate(`/instructor/contests/${contest.id}/manage`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo cuộc thi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-4">
        <Button
          variant="ghost"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/instructor/contests")}
        >
          <ArrowLeft className="size-4" />
          Quay lại khu vực cuộc thi
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Thiết lập cuộc thi
              </div>
              <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                Khởi tạo cuộc thi mới
              </h1>
              <p className="mt-1.5 max-w-3xl text-[15px] text-muted-foreground">
                Dựng trang công khai, luồng đăng ký và khu vực vận hành cho hackathon hoặc contest mới của Corelia.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
                Luồng nhiều bên tham gia
              </span>
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
                Trang công khai + vận hành
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <Trophy className="size-5 text-primary" weight="duotone" />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Bề mặt public
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    Trang giới thiệu và CTA đăng ký
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-primary" weight="duotone" />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Duyệt hồ sơ
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    Corelia giữ quyền xét duyệt
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <Gavel className="size-5 text-primary" weight="duotone" />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Chấm điểm
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    Rubric và chấm điểm theo vai trò
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <CalendarBlank className="size-5 text-primary" weight="duotone" />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Timeline
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    Hạn đăng ký, khai mạc, công bố
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="contest-title">Tên cuộc thi</FieldLabel>
                <Input
                  id="contest-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Corelia Hackathon: AI for Education"
                />
                <FieldDescription>
                  Tên hiển thị trong danh sách và trang chi tiết cuộc thi.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-tagline">Dòng mô tả ngắn</FieldLabel>
                <Input
                  id="contest-tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ví dụ: Build trong 48h • Có mentor đồng hành • Demo Day"
                />
                <FieldDescription>
                  Mô tả ngắn xuất hiện ở card và phần mở đầu của cuộc thi.
                </FieldDescription>
              </Field>

              <div className="grid gap-6 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contest-status">Trạng thái</FieldLabel>
                  <select
                    id="contest-status"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContestStatus)}
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="published">Mở đăng ký</option>
                    <option value="running">Đang diễn ra</option>
                    <option value="ended">Đã kết thúc</option>
                  </select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-location">Hình thức</FieldLabel>
                  <select
                    id="contest-location"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    value={location}
                    onChange={(e) => setLocation(e.target.value as ContestLocation)}
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="contest-starts-at">Bắt đầu</FieldLabel>
                  <Input
                    id="contest-starts-at"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-ends-at">Kết thúc</FieldLabel>
                  <Input
                    id="contest-ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-registration-deadline">
                    Hạn đăng ký
                  </FieldLabel>
                  <Input
                    id="contest-registration-deadline"
                    type="datetime-local"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="contest-max-participants">
                  Giới hạn số hồ sơ được duyệt
                </FieldLabel>
                <Input
                  id="contest-max-participants"
                  type="number"
                  min={1}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Để trống nếu không giới hạn"
                />
                <FieldDescription>
                  Nếu cần kiểm soát số đội/người tham gia, nhập giới hạn tại đây.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-description">Giới thiệu</FieldLabel>
                <textarea
                  id="contest-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Mô tả chủ đề, cách thi, mentor đồng hành, quyền lợi và trải nghiệm chính..."
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-rules">Yêu cầu và luật chơi</FieldLabel>
                <textarea
                  id="contest-rules"
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={6}
                  className="min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Điều kiện tham gia, tiêu chí chấm, cách nộp bài, yêu cầu demo..."
                />
                <FieldDescription>
                  Nội dung này sẽ hiển thị ở trang chi tiết để người tham gia chuẩn bị hồ sơ.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => navigate("/instructor/contests")}>
                Quay lại
              </Button>
              <Button disabled={!canSubmit || submitting} onClick={handleCreate}>
                {submitting ? "Đang tạo..." : "Tạo cuộc thi"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Danh sách sau khi tạo
              </div>
              <div className="mt-4 space-y-3">
                {readinessItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border-subtle bg-background p-4"
                  >
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Sau khi tạo
              </div>
              <div className="mt-4 space-y-3 text-[14px] leading-6 text-muted-foreground">
                <p>Cuộc thi sẽ được mở trong khu vực vận hành để bạn tiếp tục:</p>
                <p>1. Mời ban giám khảo và đơn vị đồng tổ chức.</p>
                <p>2. Tinh chỉnh rubric chấm điểm.</p>
                <p>3. Duyệt hồ sơ và công bố kết quả.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
