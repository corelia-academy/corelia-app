import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Copy, Languages, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMyProjects, getProjectLocaleContent, setProjectLocaleContent, updateProjectI18n } from "@/lib/projects";
import type { Project } from "@/types/projects";
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
  const { t } = useTranslation("common");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

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
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listMyProjects()
      .then((rows) => {
        if (cancelled) return;
        setProjects(rows);
        setSelectedProjectId(rows[0]?.id ?? "");
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
    const cfg = (selected.i18n ?? { supported_locales: ["vi", "en"], primary_content_locale: "vi" }) as EntityI18nConfig;
    const normalized: EntityI18nConfig = {
      supported_locales: configSupported(cfg),
      primary_content_locale: configPrimary(cfg),
    };
    setI18nDraft(normalized);
    setTargetLocale(normalized.primary_content_locale === "vi" ? "en" : "vi");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
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
  }, [primaryLocale, selected, t, targetLocale]);

  async function handleSaveTranslation() {
    if (!selected) return;
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
    if (!selected) return;
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
        <div className="text-sm font-semibold text-foreground">Project translations</div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-md border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted">
          {t("projects.empty")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-lg border border-border-subtle bg-surface-base p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                My projects
              </div>
              <div className="mt-3 grid gap-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                      p.id === selectedProjectId
                        ? "border-primary/30 bg-primary-muted text-primary"
                        : "border-border-subtle bg-surface-base text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                    }`}
                  >
                    <div className="font-medium">{p.title}</div>
                    <div className="mt-0.5 text-xs opacity-80">{p.id}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-xs text-foreground-muted">
                Public listing:{" "}
                <NavLink className="underline underline-offset-4" to="/projects">
                  {t("projects.title")}
                </NavLink>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {selected ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                  <div className="text-sm font-medium text-foreground">Localization settings</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-foreground-muted">
                      Primary content locale
                      <select
                        className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                        value={primaryLocale}
                        onChange={(e) =>
                          setI18nDraft((p) => ({ ...p, primary_content_locale: normalizeLocale(e.target.value) }))
                        }
                      >
                        <option value="vi">vi</option>
                        <option value="en">en</option>
                      </select>
                    </label>
                    <div>
                      <div className="text-xs font-medium text-foreground-muted">Supported locales</div>
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
                    <Button type="button" variant="outline" disabled={savingConfig} onClick={() => void handleSaveConfig()}>
                      {savingConfig ? t("detail.labels.saving", { defaultValue: "Saving…" }) : "Save settings"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">Translation editor</div>
                      <div className="mt-1 text-xs text-foreground-muted">
                        Empty fields fall back to primary ({primaryLocale}).{" "}
                        {loadedAt ? `Updated: ${new Date(loadedAt).toLocaleString()}` : null}
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
                        Copy from primary
                      </Button>
                      <Button
                        type="button"
                        disabled={!targetEnabled || targetLocale === primaryLocale || saving}
                        onClick={() => void handleSaveTranslation()}
                      >
                        <Save className="size-4" aria-hidden />
                        {saving ? "Saving…" : "Save translation"}
                      </Button>
                    </div>
                  </div>

                  {!targetEnabled ? (
                    <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      Target locale <b>{targetLocale}</b> is not enabled in supported locales.
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
                        Primary ({primaryLocale})
                      </div>
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <div className="text-xs font-medium text-foreground-muted">Title</div>
                          <div className="mt-1 whitespace-pre-wrap text-foreground">{selected.title || "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-foreground-muted">Summary</div>
                          <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{selected.summary || "—"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                        Translation ({targetLocale})
                      </div>
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-xs font-medium text-foreground-muted">Title</div>
                          <Input
                            value={translation.title}
                            onChange={(e) => setTranslation((p) => ({ ...p, title: e.target.value }))}
                            placeholder={selected.title ? `Fallback: ${selected.title}` : "Enter title"}
                            disabled={!targetEnabled || targetLocale === primaryLocale}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-foreground-muted">Summary</div>
                          <textarea
                            value={translation.summary}
                            onChange={(e) => setTranslation((p) => ({ ...p, summary: e.target.value }))}
                            rows={6}
                            className="w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                            placeholder="Fallback to primary if empty"
                            disabled={!targetEnabled || targetLocale === primaryLocale}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

