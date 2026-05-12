import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Copy, Languages, Save, UserRoundCheck, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MyProjectEntry } from "@/lib/projectCollaboration";
import { setMyProjectCollaborationVisibility } from "@/lib/projectCollaboration";
import {
  getProjectLocaleContent,
  listMyProjectsForAccount,
  setProjectLocaleContent,
  updateProjectI18n,
} from "@/lib/projects";
import type { Locale } from "@/types/database";
import type { EntityI18nConfig } from "@/types/entityLocales";

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
  const [entries, setEntries] = useState<MyProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.project.id === selectedProjectId) ?? null,
    [entries, selectedProjectId],
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
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listMyProjectsForAccount()
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setSelectedProjectId(rows[0]?.project.id ?? "");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

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

  useEffect(() => {
    if (!selected || !selectedIsOwner) return;
    let cancelled = false;
    setSaveError(null);
    if (targetLocale === primaryLocale) {
      setTranslation({ title: selected.title ?? "", summary: selected.summary ?? "" });
      setLoadedAt(null);
      return;
    }
    void (async () => {
      try {
        const localized = await getProjectLocaleContent(selected.id, targetLocale);
        if (cancelled) return;
        setTranslation({
          title: String(localized?.title ?? ""),
          summary: String(localized?.summary ?? ""),
        });
        setLoadedAt(localized?.updated_at ?? null);
      } catch (e) {
        if (!cancelled) setSaveError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryLocale, selected, selectedIsOwner, t, targetLocale]);

  async function handleSaveTranslation() {
    if (!selected || !selectedIsOwner) return;
    if (!targetEnabled || targetLocale === primaryLocale) return;
    setSaving(true);
    setSaveError(null);
    try {
      await setProjectLocaleContent(selected.id, targetLocale, {
        title: translation.title.trim() || undefined,
        summary: translation.summary.trim() || null,
      });
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveConfig() {
    if (!selected || !selectedIsOwner) return;
    setSavingConfig(true);
    setSaveError(null);
    try {
      const normalized: EntityI18nConfig = {
        supported_locales: configSupported(i18nDraft),
        primary_content_locale: configPrimary(i18nDraft),
      };
      await updateProjectI18n(selected.id, normalized);
      setI18nDraft(normalized);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
    } finally {
      setSavingConfig(false);
    }
  }

  async function handlePortfolioVisibilityChange(nextValue: boolean) {
    if (!selected || !selectedAccess || selectedIsOwner) return;
    setSavingVisibility(true);
    setSaveError(null);
    try {
      await setMyProjectCollaborationVisibility(selected.id, nextValue);
      setEntries((prev) =>
        prev.map((entry) =>
          entry.project.id === selected.id
            ? {
                ...entry,
                access: {
                  ...entry.access,
                  show_in_portfolio: nextValue,
                },
              }
            : entry,
        ),
      );
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : t("account:projects.errors.visibilityFailed"),
      );
    } finally {
      setSavingVisibility(false);
    }
  }

  function copyFromPrimary() {
    if (!selected) return;
    setTranslation({ title: selected.title ?? "", summary: selected.summary ?? "" });
  }

  if (loading) {
    return <div className="text-sm text-foreground-muted">{t("status.loading")}</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
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
        <div className="rounded-md border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted">
          {t("projects.empty")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-lg border border-border-subtle bg-surface-base p-3">
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
                      project.id === selectedProjectId
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
                      <label className="mt-4 flex items-start gap-3 rounded-md border border-border-subtle bg-surface-base p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={Boolean(selectedAccess.show_in_portfolio)}
                          disabled={savingVisibility}
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

                    <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
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
                        <div className="mt-2 flex flex-wrap gap-3 rounded-md border border-border-subtle bg-surface-base p-3 text-sm">
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
                        disabled={savingConfig}
                        onClick={() => void handleSaveConfig()}
                      >
                        {savingConfig
                          ? t("detail.labels.saving", { defaultValue: "Saving…" })
                          : t("account:projects.saveSettings")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {selectedIsOwner ? (
                  <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
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
                          disabled={!targetEnabled || targetLocale === primaryLocale || saving}
                          onClick={() => void handleSaveTranslation()}
                        >
                          <Save className="size-4" aria-hidden />
                          {saving
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

                      <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
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
