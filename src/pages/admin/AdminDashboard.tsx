import { useEffect, useMemo, useState } from "react";
import { FloppyDiskBack, PushPinSimple, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHomeDashboardConfig, updateHomeDashboardConfig } from "@/lib/dashboardConfig";
import { getPublishedCourses } from "@/lib/courses";
import { listContests } from "@/lib/contests";
import { listOfflineCourses } from "@/lib/offline";
import type { DashboardPinnedProgram, DashboardPinnedProgramType } from "@/types/dashboard";
import type { Course } from "@/types/courses";
import type { Contest } from "@/types/contests";
import type { OfflineCourse } from "@/types/offline";

type ProgramOption = {
  value: string;
  label: string;
  type: DashboardPinnedProgramType;
  subtitle: string;
};

type EditablePinnedProgram = {
  id: string;
  type: DashboardPinnedProgramType;
  ref_id: string;
  badge: string;
  title_override: string;
  description_override: string;
  cta_label: string;
  active: boolean;
  order: number;
};

function createEmptyPinnedProgram(order: number): EditablePinnedProgram {
  return {
    id: `slot-${order}`,
    type: "course",
    ref_id: "",
    badge: "",
    title_override: "",
    description_override: "",
    cta_label: "",
    active: true,
    order,
  };
}

function toEditable(item: DashboardPinnedProgram, order: number): EditablePinnedProgram {
  return {
    id: item.id,
    type: item.type,
    ref_id: item.ref_id,
    badge: item.badge ?? "",
    title_override: item.title_override ?? "",
    description_override: item.description_override ?? "",
    cta_label: item.cta_label ?? "",
    active: item.active,
    order,
  };
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [programs, setPrograms] = useState<EditablePinnedProgram[]>([
    createEmptyPinnedProgram(0),
    createEmptyPinnedProgram(1),
    createEmptyPinnedProgram(2),
  ]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [offlineCourses, setOfflineCourses] = useState<OfflineCourse[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const [config, courseRows, contestRows, offlineCourseRows] =
          await Promise.all([
            getHomeDashboardConfig(),
            getPublishedCourses().catch(() => [] as Course[]),
            listContests().catch(() => [] as Contest[]),
            listOfflineCourses().catch(() => [] as OfflineCourse[]),
          ]);

        if (cancelled) return;

        setCourses(courseRows);
        setContests(
          contestRows.filter((item) => item.status === "published" || item.status === "running"),
        );
        setOfflineCourses(offlineCourseRows.filter((item) => item.published));

        const normalized = [...config.pinned_programs]
          .sort((a, b) => a.order - b.order)
          .slice(0, 3)
          .map((item, index) => toEditable(item, index));

        while (normalized.length < 3) {
          normalized.push(createEmptyPinnedProgram(normalized.length));
        }
        setPrograms(normalized);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể tải cấu hình dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, []);

  const programOptions = useMemo<ProgramOption[]>(() => {
    return [
      ...courses.map((item) => ({
        value: item.id,
        label: item.title,
        type: "course" as const,
        subtitle: "Khoá học online",
      })),
      ...contests.map((item) => ({
        value: item.id,
        label: item.title,
        type: "contest" as const,
        subtitle: "Contest",
      })),
      ...offlineCourses.map((item) => ({
        value: item.id,
        label: item.title,
        type: "offline_course" as const,
        subtitle: "Chương trình offline",
      })),
    ];
  }, [contests, courses, offlineCourses]);

  function updateProgram(index: number, patch: Partial<EditablePinnedProgram>) {
    setPrograms((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch, order: index } : item,
      ),
    );
    setSaveMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const payload: DashboardPinnedProgram[] = programs
        .filter((item) => item.active && item.ref_id)
        .map((item, index) => ({
          id: item.id,
          type: item.type,
          ref_id: item.ref_id,
          badge: item.badge.trim() || null,
          title_override: item.title_override.trim() || null,
          description_override: item.description_override.trim() || null,
          cta_label: item.cta_label.trim() || null,
          active: item.active,
          order: index,
        }));

      await updateHomeDashboardConfig({ pinned_programs: payload });
      setSaveMessage("Đã lưu cấu hình ghim chương trình lên dashboard.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu cấu hình dashboard.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              <PushPinSimple className="size-4" weight="duotone" />
              Ghim chương trình trên dashboard
            </div>
            <h2 className="mt-2 text-xl font-medium tracking-tight text-foreground">
              Chọn tối đa 3 chương trình để đẩy lên Home của học viên
            </h2>
            <p className="mt-1.5 max-w-3xl text-[14px] leading-6 text-muted-foreground">
              Dashboard của học viên vẫn ưu tiên dữ liệu cá nhân. Khu vực này chỉ dành cho những
              chương trình mà admin hoặc học vụ muốn nhấn mạnh trong một giai đoạn nhất định.
            </p>
          </div>
          <Button onClick={() => void handleSave()} disabled={loading || saving}>
            <FloppyDiskBack className="size-4" weight="duotone" />
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}
        {saveMessage ? (
          <div className="mt-4 rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-[13px] text-success">
            {saveMessage}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {programs.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border-subtle bg-background p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                    Slot {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {item.active ? "Đang bật" : "Đang tắt"}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateProgram(index, { active: e.target.checked })}
                  />
                  Hiển thị
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 text-[12px] text-muted-foreground">Loại chương trình</div>
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateProgram(index, {
                        type: e.target.value as DashboardPinnedProgramType,
                        ref_id: "",
                      })
                    }
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="course">Khoá học online</option>
                    <option value="contest">Contest</option>
                    <option value="offline_course">Chương trình offline</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-[12px] text-muted-foreground">Chương trình nguồn</div>
                  <select
                    value={item.ref_id}
                    onChange={(e) => updateProgram(index, { ref_id: e.target.value })}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Chọn chương trình</option>
                    {programOptions
                      .filter((option) => option.type === item.type)
                      .map((option) => (
                        <option key={`${option.type}-${option.value}`} value={option.value}>
                          {option.label} · {option.subtitle}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-[12px] text-muted-foreground">Badge tuỳ chỉnh</div>
                  <Input
                    value={item.badge}
                    onChange={(e) => updateProgram(index, { badge: e.target.value })}
                    placeholder="Ví dụ: Đang mở đăng ký"
                  />
                </div>

                <div>
                  <div className="mb-1 text-[12px] text-muted-foreground">Tiêu đề override</div>
                  <Input
                    value={item.title_override}
                    onChange={(e) => updateProgram(index, { title_override: e.target.value })}
                    placeholder="Để trống nếu dùng tiêu đề gốc"
                  />
                </div>

                <div>
                  <div className="mb-1 text-[12px] text-muted-foreground">Mô tả override</div>
                  <textarea
                    value={item.description_override}
                    onChange={(e) =>
                      updateProgram(index, { description_override: e.target.value })
                    }
                    placeholder="Để trống nếu dùng mô tả gốc"
                    className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <div className="mb-1 text-[12px] text-muted-foreground">Nhãn CTA</div>
                  <Input
                    value={item.cta_label}
                    onChange={(e) => updateProgram(index, { cta_label: e.target.value })}
                    placeholder="Ví dụ: Xem chương trình"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-border-subtle bg-muted/30 px-4 py-3 text-[13px] leading-6 text-muted-foreground">
          <div className="flex items-start gap-2">
            <Sparkle className="mt-0.5 size-4 shrink-0 text-primary" weight="duotone" />
            <span>
              Dashboard chỉ hiển thị những slot đang bật và đã chọn chương trình nguồn. Nếu bạn
              để trống tiêu đề hoặc mô tả override, hệ thống sẽ lấy nội dung từ chương trình gốc.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
