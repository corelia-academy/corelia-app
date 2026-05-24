import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { getHackathonLocaleContent, setHackathonLocaleContent, updateContest } from "@/lib/hackathons";
import type { Locale } from "@/types/database";
import type { ContestFaqEntry, ContestTimelineMilestone } from "@/types/hackathons";
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

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinLines(value: string[] | undefined | null): string {
  return Array.isArray(value) ? value.join("\n") : "";
}

type TranslationDraft = {
  title: string;
  tagline: string;
  description: string;
  rules: string;
  prize_pool_summary: string;
  faqsText: string; // Q: ... \n A: ... blocks
  milestonesTitlesText: string; // one title per line (aligned by index)
};

function faqTextToEntries(text: string): ContestFaqEntry[] {
  const lines = text.split("\n");
  const entries: ContestFaqEntry[] = [];
  let q = "";
  let a = "";
  function flush() {
    const question = q.trim();
    const answer = a.trim();
    if (question && answer) entries.push({ question, answer });
    q = "";
    a = "";
  }
  for (const line of lines) {
    if (line.startsWith("Q:")) {
      flush();
      q = line.slice(2).trim();
    } else if (line.startsWith("A:")) {
      a = line.slice(2).trim();
    } else if (!line.trim()) {
      // ignore empty
    } else if (!a) {
      q = (q ? `${q}\n` : "") + line;
    } else {
      a = (a ? `${a}\n` : "") + line;
    }
  }
  flush();
  return entries;
}

function entriesToFaqText(entries: ContestFaqEntry[] | undefined | null): string {
  if (!entries?.length) return "";
  return entries
    .map((e) => `Q: ${e.question}\nA: ${e.answer}`)
    .join("\n\n");
}

export function ContestDetailTranslationsPanel({ vm }: { vm: ContestDetailViewModel }) {
  const { contest, translate, isManageView, activeManageSection, isManager } = vm;
  const visible = isManageView && isManager && activeManageSection === "translations";

  const initialConfig = (contest.i18n ?? { supported_locales: ["vi", "en"], primary_content_locale: "vi" }) as EntityI18nConfig;
  const [i18nConfigDraft, setI18nConfigDraft] = useState<EntityI18nConfig>(initialConfig);
  const [savingConfig, setSavingConfig] = useState(false);
  const primaryLocale = configPrimary(i18nConfigDraft);
  const supportedLocales = configSupported(i18nConfigDraft);

  const [targetLocale, setTargetLocale] = useState<Locale>(primaryLocale === "vi" ? "en" : "vi");
  const targetEnabled = supportedLocales.includes(targetLocale);

  const primarySnapshot = useMemo(() => {
    return {
      title: contest.title ?? "",
      tagline: contest.tagline ?? "",
      description: contest.description ?? "",
      rules: contest.rules ?? "",
      prize_pool_summary: contest.prize_pool_summary ?? "",
      faqs: contest.faqs ?? [],
      timeline_milestones: contest.timeline_milestones ?? [],
    };
  }, [contest]);

  const [draft, setDraft] = useState<TranslationDraft>(() => ({
    title: "",
    tagline: "",
    description: "",
    rules: "",
    prize_pool_summary: "",
    faqsText: "",
    milestonesTitlesText: "",
  }));
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef<string>("");
  const dirty = JSON.stringify(draft) !== initialRef.current;
  const configDirty = JSON.stringify(i18nConfigDraft) !== JSON.stringify(initialConfig);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    if (targetLocale === primaryLocale) {
      const next: TranslationDraft = {
        title: primarySnapshot.title,
        tagline: primarySnapshot.tagline,
        description: primarySnapshot.description,
        rules: primarySnapshot.rules,
        prize_pool_summary: primarySnapshot.prize_pool_summary,
        faqsText: entriesToFaqText(primarySnapshot.faqs),
        milestonesTitlesText: joinLines(primarySnapshot.timeline_milestones?.map((m) => m.title)),
      };
      setDraft(next);
      initialRef.current = JSON.stringify(next);
      setLoadedAt(null);
      return;
    }
    void (async () => {
      try {
        const localized = await getHackathonLocaleContent(contest.id, targetLocale);
        if (cancelled) return;
        const next: TranslationDraft = {
          title: String(localized?.title ?? ""),
          tagline: String(localized?.tagline ?? ""),
          description: String(localized?.description ?? ""),
          rules: String(localized?.rules ?? ""),
          prize_pool_summary: String(localized?.prize_pool_summary ?? ""),
          faqsText: entriesToFaqText(localized?.faqs ?? []),
          milestonesTitlesText: joinLines(
            (localized?.timeline_milestones ?? []).map((m: ContestTimelineMilestone) => m.title),
          ),
        };
        setDraft(next);
        initialRef.current = JSON.stringify(next);
        setLoadedAt(localized?.updated_at ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : translate("detail.errors.loadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contest.id, primaryLocale, primarySnapshot, targetLocale, translate, visible]);

  async function handleSaveConfig() {
    if (!visible) return;
    setSavingConfig(true);
    setError(null);
    try {
      const normalized: EntityI18nConfig = {
        supported_locales: configSupported(i18nConfigDraft),
        primary_content_locale: configPrimary(i18nConfigDraft),
      };
      await updateContest(contest.id, { i18n: normalized });
      setI18nConfigDraft(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : translate("detail.errors.loadFailed"));
    } finally {
      setSavingConfig(false);
    }
  }

  function copyAllFromPrimary() {
    setDraft({
      title: primarySnapshot.title,
      tagline: primarySnapshot.tagline,
      description: primarySnapshot.description,
      rules: primarySnapshot.rules,
      prize_pool_summary: primarySnapshot.prize_pool_summary,
      faqsText: entriesToFaqText(primarySnapshot.faqs),
      milestonesTitlesText: joinLines(primarySnapshot.timeline_milestones?.map((m) => m.title)),
    });
  }

  async function handleSave() {
    if (!visible) return;
    if (!targetEnabled) return;
    if (targetLocale === primaryLocale) return;
    setSaving(true);
    setError(null);
    try {
      const milestoneTitles = splitLines(draft.milestonesTitlesText);
      const nextMilestones: ContestTimelineMilestone[] = (primarySnapshot.timeline_milestones ?? []).map(
        (m, idx) => ({ ...m, title: milestoneTitles[idx] ?? "" }),
      ).filter((m) => m.title.trim().length > 0);

      await setHackathonLocaleContent(contest.id, targetLocale, {
        title: draft.title.trim() || undefined,
        tagline: draft.tagline.trim() || undefined,
        description: draft.description.trim() || null,
        rules: draft.rules.trim() || null,
        prize_pool_summary: draft.prize_pool_summary.trim() || null,
        faqs: faqTextToEntries(draft.faqsText),
        timeline_milestones: nextMilestones,
      });

      initialRef.current = JSON.stringify(draft);
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : translate("detail.errors.loadFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <Card id="translations">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {translate("workspace.tabs.translations", { defaultValue: "Translations" })}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {translate("workspace.manage.translations.description", {
                defaultValue: "Maintain localized versions of the public hackathon content.",
              })}
            </p>
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
            <Button type="button" variant="outline" onClick={copyAllFromPrimary}>
              <Copy className="size-4" aria-hidden />
              {translate("actions.copy", { defaultValue: "Copy" })}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving || !targetEnabled || targetLocale === primaryLocale}
            >
              <Save className="size-4" aria-hidden />
              {saving ? translate("detail.labels.saving") : translate("actions.save", { defaultValue: "Save" })}
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border-subtle bg-surface-raised p-4">
          <div className="text-sm font-medium text-foreground">
            {translate("workspace.manage.translations.settingsTitle", { defaultValue: "Localization settings" })}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-foreground-muted">
              Primary content locale
              <select
                className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                value={primaryLocale}
                onChange={(e) =>
                  setI18nConfigDraft((p) => ({ ...p, primary_content_locale: normalizeLocale(e.target.value) }))
                }
              >
                <option value="vi">vi</option>
                <option value="en">en</option>
              </select>
            </label>
            <div>
              <div className="text-xs font-medium text-foreground-muted">Supported locales</div>
              <div className="mt-2 flex flex-wrap gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 text-sm">
                {(["vi", "en"] as const).map((lng) => (
                  <label key={lng} className="inline-flex items-center gap-2 text-foreground">
                    <input
                      type="checkbox"
                      checked={supportedLocales.includes(lng)}
                      onChange={(e) => {
                        setI18nConfigDraft((prev) => {
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
              disabled={savingConfig || !configDirty}
              onClick={() => void handleSaveConfig()}
            >
              {savingConfig ? translate("detail.labels.saving") : translate("actions.save", { defaultValue: "Save" })}
            </Button>
          </div>
        </div>

        {!targetEnabled ? (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            Target locale <b>{targetLocale}</b> is not enabled in supported locales.
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
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
                <div className="mt-1 whitespace-pre-wrap text-foreground">{primarySnapshot.title || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-foreground-muted">Tagline</div>
                <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.tagline || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-foreground-muted">Description</div>
                <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.description || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-foreground-muted">Rules</div>
                <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.rules || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-foreground-muted">Prize pool summary</div>
                <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.prize_pool_summary || "—"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Translation ({targetLocale})
              </div>
              <div className="text-xs text-foreground-muted">
                {loadedAt ? `Updated: ${new Date(loadedAt).toLocaleString()}` : null}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-foreground-muted">
                Title
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder={primarySnapshot.title ? `Fallback: ${primarySnapshot.title}` : "Enter title"}
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>

              <label className="block text-xs font-medium text-foreground-muted">
                Tagline
                <input
                  value={draft.tagline}
                  onChange={(e) => setDraft((p) => ({ ...p, tagline: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Fallback to primary if empty"
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>

              <label className="block text-xs font-medium text-foreground-muted">
                Description
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Fallback to primary if empty"
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>

              <label className="block text-xs font-medium text-foreground-muted">
                Rules
                <textarea
                  value={draft.rules}
                  onChange={(e) => setDraft((p) => ({ ...p, rules: e.target.value }))}
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Fallback to primary if empty"
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>

              <label className="block text-xs font-medium text-foreground-muted">
                Prize pool summary
                <textarea
                  value={draft.prize_pool_summary}
                  onChange={(e) => setDraft((p) => ({ ...p, prize_pool_summary: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Fallback to primary if empty"
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>

              <label className="block text-xs font-medium text-foreground-muted">
                FAQs (use `Q:` / `A:` blocks)
                <textarea
                  value={draft.faqsText}
                  onChange={(e) => setDraft((p) => ({ ...p, faqsText: e.target.value }))}
                  rows={8}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Q: ...\nA: ...\n\nQ: ...\nA: ..."
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>

              <label className="block text-xs font-medium text-foreground-muted">
                Timeline milestone titles (one per line, aligned by order)
                <textarea
                  value={draft.milestonesTitlesText}
                  onChange={(e) => setDraft((p) => ({ ...p, milestonesTitlesText: e.target.value }))}
                  rows={6}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Milestone 1 title\nMilestone 2 title\n..."
                  disabled={!targetEnabled || targetLocale === primaryLocale}
                />
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

