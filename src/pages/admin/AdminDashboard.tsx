import { useEffect, useMemo, useState } from "react";
import { Pin, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHomeDashboardConfig, updateHomeDashboardConfig } from "@/lib/dashboardConfig";
import { getPublishedCourses } from "@/lib/courses";
import { listContests } from "@/lib/contests";
import type { DashboardPinnedProgram, DashboardPinnedProgramType } from "@/types/dashboard";
import type { Course } from "@/types/courses";
import type { Contest } from "@/types/contests";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";

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
  const { authInitialized, user } = useAuth();
  const { t } = useTranslation("admin");
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

  useEffect(() => {
    if (!authInitialized) return;

    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const [config, courseRows, contestRows] =
          await Promise.all([
            getHomeDashboardConfig(),
            getPublishedCourses().catch(() => [] as Course[]),
            listContests(user ?? null).catch(() => [] as Contest[]),
          ]);

        if (cancelled) return;

        setCourses(courseRows);
        setContests(
          contestRows.filter((item) => item.status === "published" || item.status === "running"),
        );

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
          setError(err instanceof Error ? err.message : t("dashboard.errors.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [authInitialized, t, user?.id]);

  const programOptions = useMemo<ProgramOption[]>(() => {
    return [
      ...courses.map((item) => ({
        value: item.id,
        label: item.title,
        type: "course" as const,
        subtitle: t("dashboard.programType.course"),
      })),
      ...contests.map((item) => ({
        value: item.id,
        label: item.title,
        type: "contest" as const,
        subtitle: t("dashboard.programType.contest"),
      })),
    ];
  }, [contests, courses, t]);

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
      setSaveMessage(t("dashboard.toasts.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-lg border border-border-subtle bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Pin className="size-4" aria-hidden />
              {t("dashboard.hero.eyebrow")}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">
              {t("dashboard.hero.title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {t("dashboard.hero.description")}
            </p>
          </div>
          <Button onClick={() => void handleSave()} disabled={loading || saving}>
            <Save className="size-4" aria-hidden />
            {saving ? t("dashboard.actions.saving") : t("dashboard.actions.save")}
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {saveMessage ? (
          <div className="mt-4 rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
            {saveMessage}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {programs.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-border-subtle bg-background p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.slot.label", { index: index + 1 })}
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {item.active ? t("dashboard.slot.activeOn") : t("dashboard.slot.activeOff")}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateProgram(index, { active: e.target.checked })}
                  />
                  {t("dashboard.slot.show")}
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("dashboard.form.programTypeLabel")}
                  </div>
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateProgram(index, {
                        type: e.target.value as DashboardPinnedProgramType,
                        ref_id: "",
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="course">{t("dashboard.programType.course")}</option>
                    <option value="contest">{t("dashboard.programType.contest")}</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("dashboard.form.programSourceLabel")}
                  </div>
                  <select
                    value={item.ref_id}
                    onChange={(e) => updateProgram(index, { ref_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t("dashboard.form.programSourcePlaceholder")}</option>
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
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("dashboard.form.badgeLabel")}
                  </div>
                  <Input
                    value={item.badge}
                    onChange={(e) => updateProgram(index, { badge: e.target.value })}
                    placeholder={t("dashboard.form.badgePlaceholder")}
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("dashboard.form.titleOverrideLabel")}
                  </div>
                  <Input
                    value={item.title_override}
                    onChange={(e) => updateProgram(index, { title_override: e.target.value })}
                    placeholder={t("dashboard.form.titleOverridePlaceholder")}
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("dashboard.form.descriptionOverrideLabel")}
                  </div>
                  <textarea
                    value={item.description_override}
                    onChange={(e) =>
                      updateProgram(index, { description_override: e.target.value })
                    }
                    placeholder={t("dashboard.form.descriptionOverridePlaceholder")}
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("dashboard.form.ctaLabel")}
                  </div>
                  <Input
                    value={item.cta_label}
                    onChange={(e) => updateProgram(index, { cta_label: e.target.value })}
                    placeholder={t("dashboard.form.ctaPlaceholder")}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-border-subtle bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              {t("dashboard.hint")}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
