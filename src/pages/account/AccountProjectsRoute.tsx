import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Copy, Languages, Save, UserRoundCheck, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MyProjectEntry } from "@/lib/projectCollaboration";
import { setMyProjectCollaborationVisibility } from "@/lib/projectCollaboration";
import {
  setProjectLocaleContent,
  updateProjectI18n,
} from "@/lib/projects";
import type { Locale } from "@/types/database";
import type { EntityI18nConfig } from "@/types/entityLocales";
import {
  accountKeys,
  accountProjectLocaleQueryOptions,
  accountProjectsQueryOptions,
} from "@/features/account/accountQueries";
import { useAuth } from "@/stores/authStore";

function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "vi";
}

function configPrimary(config: EntityI18nConfig | null | undefined): Locale {
  return normalizeLocale(config?.primary_content_locale);
}

function configSupported(config: EntityI18nConfig | null | undefined): Locale[] {
  const raw = config?.supported_locales;
  const fallback: Locale[] = ["vi", "en"];
  const list = Array.isArray(raw) && raw.length ? raw.map(normalizeLocale) : fallback;
  return Array.from(new Set(list));
}

export function AccountProjectsRoute() {
  const { t } = useTranslation(["common", "account"]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectsQuery = useQuery(accountProjectsQueryOptions(user?.id));
  const entries = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const effectiveSelectedProjectId = selectedProjectId || entries[0]?.project.id || "";
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.project.id === effectiveSelectedProjectId) ?? null,
    [effectiveSelectedProjectId, entries],
  );
  const selected = selectedEntry?.project ?? null;
  const selectedAccess = selectedEntry?.access ?? null;
  const selectedIsOwner = Boolean(selectedAccess?.is_owner);

  const [targetLocale, setTargetLocale] = useState<Locale>("en");
  const [i18nDraft, setI18nDraft] = useState<EntityI18nConfig>({
    supported_locales: ["vi", "en"],
    primary_content_locale: "vi",
  });
  const primaryLocale = configPrimary(i18nDraft);
  const supportedLocales = configSupported(i18nDraft);
  const targetEnabled = supportedLocales.includes(targetLocale);

  const [translation, setTranslation] = useState({ title: "", summary: "" });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const cfg = (selected.i18n ?? {
      supported_locales: ["vi", "en"],
      primary_content_locale: "vi",
    }) as EntityI18nConfig;
    const normalized: EntityI18nConfig = {
      supported_locales: configSupported(cfg),
      primary_content_locale: configPrimary(cfg),
    };
    setI18nDraft(normalized);
    setTargetLocale(normalized.primary_content_locale === "vi" ? "en" : "vi");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const localeQuery = useQuery(
    accountProjectLocaleQueryOptions(
      user?.id,
      selected?.id,
      targetLocale,
      selectedIsOwner && targetLocale !== primaryLocale,
    ),
  );

  useEffect(() => {
    if (!selected || !selectedIsOwner) return;
    setSaveError(null);
    const localized = targetLocale === primaryLocale ? null : localeQuery.data;
    setTranslation({
      title: String(localized?.title ?? (targetLocale === primaryLocale ? selected.title : "") ?? ""),
      summary: String(localized?.summary ?? (targetLocale === primaryLocale ? selected.summary : "") ?? ""),
    });
    setLoadedAt(localized?.updated_at ?? null);
  }, [localeQuery.data, primaryLocale, selected, selectedIsOwner, targetLocale]);

  const saveTranslationMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      return setProjectLocaleContent(selected.id, targetLocale, {
        title: translation.title.trim() || undefined,
        summary: translation.summary.trim() || null,
      });
    },
    onSuccess: () => {
      setLoadedAt(new Date().toISOString());
      if (user?.id && selected) {
        void queryClient.invalidateQueries({
          queryKey: accountKeys.projectLocale(user.id, selected.id, targetLocale),
        });
      }
    },
  });
  const saveConfigMutation = useMutation({
    mutationFn: async (normalized: EntityI18nConfig) => {
      if (!selected) return;
      await updateProjectI18n(selected.id, normalized);
      return normalized;
    },
    onSuccess: (normalized) => {
      if (normalized) setI18nDraft(normalized);
      if (user?.id) void queryClient.invalidateQueries({ queryKey: accountKeys.projects(user.id) });
    },
  });
  const visibilityMutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      if (!selected) return nextValue;
      await setMyProjectCollaborationVisibility(selected.id, nextValue);
      return nextValue;
    },
    onSuccess: (nextValue) => {
      if (!user?.id || !selected) return;
      queryClient.setQueryData<MyProjectEntry[]>(
        accountKeys.projects(user.id),
        (previous = []) => previous.map((entry) =>
          entry.project.id === selected.id
            ? { ...entry, access: { ...entry.access, show_in_portfolio: nextValue } }
            : entry,
        ),
      );
    },
  });

  async function handleSaveTranslation() {
    if (!selected || !selectedIsOwner) return;
    if (!targetEnabled || targetLocale === primaryLocale) return;
    setSaveError(null);
    try {
      await saveTranslationMutation.mutateAsync();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
    } finally { /* mutation owns pending state */ }
  }

  async function handleSaveConfig() {
    if (!selected || !selectedIsOwner) return;
    setSaveError(null);
    try {
      const normalized: EntityI18nConfig = {
        supported_locales: configSupported(i18nDraft),
        primary_content_locale: configPrimary(i18nDraft),
      };
      await saveConfigMutation.mutateAsync(normalized);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
    } finally { /* mutation owns pending state */ }
  }

  async function handlePortfolioVisibilityChange(nextValue: boolean) {
    if (!selected || !selectedAccess || selectedIsOwner) return;
    setSaveError(null);
    try {
      await visibilityMutation.mutateAsync(nextValue);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : t("account:projects.errors.visibilityFailed"),
      );
    } finally { /* mutation owns pending state */ }
  }

  function copyFromPrimary() {
    if (!selected) return;
    setTranslation({ title: selected.title ?? "", summary: selected.summary ?? "" });
  }

  if (projectsQuery.isPending) {
    return <div className="text-sm text-foreground-muted">{t("status.loading")}</div>;
  }
  if (projectsQuery.error) {
    return <div className="text-sm text-destructive">{projectsQuery.error instanceof Error ? projectsQuery.error.message : t("projects.errors.loadFailed")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Languages className="size-4 text-primary" aria-hidden />
        <div className="text-sm font-semibold text-foreground">
          {t("account:projects.pageTitle")}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted">
          {t("projects.empty")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                {t("account:projects.listTitle")}
              </div>
              <div className="mt-3 grid gap-2">
                {entries.map(({ project, access }) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                      project.id === effectiveSelectedProjectId
                        ? "border-primary/30 bg-primary-muted text-primary"
                        : "border-border-subtle bg-surface-base text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{project.title}</div>
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {access.is_owner
                          ? t("account:projects.ownerBadge")
                          : t("account:projects.collaboratorBadge")}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">{project.id}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-xs text-foreground-muted">
                {t("account:projects.publicListingLabel")}{" "}
                <NavLink className="underline underline-offset-4" to="/projects">
                  {t("projects.title")}
                </NavLink>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {selected ? (
              <div className="space-y-4">
                {!selectedIsOwner && selectedAccess ? (
                  <>
                    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <UserRoundPlus className="size-4 text-primary" aria-hidden />
                        {t("account:projects.collaboratorCardTitle")}
                      </div>
                      <p className="mt-2 text-sm text-foreground-muted">
                        {t("account:projects.collaboratorCardBody")}
                      </p>
                      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={Boolean(selectedAccess.show_in_portfolio)}
                          disabled={visibilityMutation.isPending}
                          onChange={(e) =>
                            void handlePortfolioVisibilityChange(e.target.checked)
                          }
                        />
                        <span className="space-y-1">
                          <span className="block font-medium text-foreground">
                            {t("account:projects.showOnProfileLabel")}
                          </span>
                          <span className="block text-foreground-muted">
                            {t("account:projects.showOnProfileHint")}
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <UserRoundCheck className="size-4 text-primary" aria-hidden />
                        {t("account:projects.ownerOnlyTitle")}
                      </div>
                      <p className="mt-2 text-sm text-foreground-muted">
                        {t("account:projects.ownerOnlyBody")}
                      </p>
                    </div>
                  </>
                ) : null}

                {selectedIsOwner ? (
                  <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                    <div className="text-sm font-medium text-foreground">
                      {t("account:projects.localizationSettingsTitle")}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-foreground-muted">
                        {t("account:projects.primaryLocaleLabel")}
                        <select
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                          value={primaryLocale}
                          onChange={(e) =>
                            setI18nDraft((p) => ({
                              ...p,
                              primary_content_locale: normalizeLocale(e.target.value),
                            }))
                          }
                        >
                          <option value="vi">vi</option>
                          <option value="en">en</option>
                        </select>
                      </label>
                      <div>
                        <div className="text-xs font-medium text-foreground-muted">
                          {t("account:projects.supportedLocalesLabel")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 text-sm">
                          {(["vi", "en"] as const).map((lng) => (
                            <label key={lng} className="inline-flex items-center gap-2 text-foreground">
                              <input
                                type="checkbox"
                                checked={supportedLocales.includes(lng)}
                                onChange={(e) => {
                                  setI18nDraft((prev) => {
                                    const next = new Set(configSupported(prev));
                                    if (e.target.checked) next.add(lng);
                                    else next.delete(lng);
                                    return { ...prev, supported_locales: Array.from(next) };
                                  });
                                }}
                              />
                              {lng}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saveConfigMutation.isPending}
                        onClick={() => void handleSaveConfig()}
                      >
                        {saveConfigMutation.isPending
                          ? t("detail.labels.saving", { defaultValue: "Saving…" })
                          : t("account:projects.saveSettings")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {selectedIsOwner ? (
                  <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {t("account:projects.translationEditorTitle")}
                        </div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {t("account:projects.translationEditorHint", {
                            primaryLocale,
                          })}{" "}
                          {loadedAt
                            ? t("account:projects.updatedAt", {
                                datetime: new Date(loadedAt).toLocaleString(),
                              })
                            : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="h-10 rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                          value={targetLocale}
                          onChange={(e) => setTargetLocale(normalizeLocale(e.target.value))}
                        >
                          <option value="vi">vi</option>
                          <option value="en">en</option>
                        </select>
                        <Button type="button" variant="outline" onClick={copyFromPrimary}>
                          <Copy className="size-4" aria-hidden />
                          {t("account:projects.copyFromPrimary")}
                        </Button>
                        <Button
                          type="button"
                          disabled={!targetEnabled || targetLocale === primaryLocale || saveTranslationMutation.isPending}
                          onClick={() => void handleSaveTranslation()}
                        >
                          <Save className="size-4" aria-hidden />
                          {saveTranslationMutation.isPending
                            ? t("account:projects.savingTranslation")
                            : t("account:projects.saveTranslation")}
                        </Button>
                      </div>
                    </div>

                    {!targetEnabled ? (
                      <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                        {t("account:projects.targetLocaleDisabled", {
                          locale: targetLocale,
                        })}
                      </div>
                    ) : null}
                    {saveError ? (
                      <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                        {saveError}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                          {t("account:projects.primaryColumnTitle", { locale: primaryLocale })}
                        </div>
                        <div className="mt-3 space-y-3 text-sm">
                          <div>
                            <div className="text-xs font-medium text-foreground-muted">
                              {t("account:projects.fieldTitle")}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-foreground">
                              {selected.title || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-foreground-muted">
                              {t("account:projects.fieldSummary")}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-foreground-muted">
                              {selected.summary || "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                          {t("account:projects.translationColumnTitle", { locale: targetLocale })}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <div className="text-xs font-medium text-foreground-muted">
                              {t("account:projects.fieldTitle")}
                            </div>
                            <Input
                              value={translation.title}
                              onChange={(e) =>
                                setTranslation((p) => ({ ...p, title: e.target.value }))
                              }
                              placeholder={
                                selected.title
                                  ? t("account:projects.titleFallback", {
                                      title: selected.title,
                                    })
                                  : t("account:projects.titlePlaceholder")
                              }
                              disabled={!targetEnabled || targetLocale === primaryLocale}
                            />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-foreground-muted">
                              {t("account:projects.fieldSummary")}
                            </div>
                            <textarea
                              value={translation.summary}
                              onChange={(e) =>
                                setTranslation((p) => ({ ...p, summary: e.target.value }))
                              }
                              rows={6}
                              className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                              placeholder={t("account:projects.summaryPlaceholder")}
                              disabled={!targetEnabled || targetLocale === primaryLocale}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!selectedIsOwner && saveError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                    {saveError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
