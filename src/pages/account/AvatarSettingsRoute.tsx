import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Avatar as HumationAvatar } from "@humation/react";
import { getPartsForSlot } from "@humation/core";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/stores/authStore";
import { queryClient } from "@/lib/queryClient";
import { avatarAssets } from "@/lib/avatarAssets";
import { saveMyAvatar } from "@/lib/avatarProfile";
import { safeAvatarConfig, EMPTY_AVATAR_CONFIG, type AvatarConfig } from "../../../shared/avatarConfig";

function displayPart(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AvatarSettingsRoute() {
  const { t } = useTranslation("account");
  const { user, profile, refreshProfile } = useAuth();
  const [seed, setSeed] = useState<string | null>(profile?.avatar_seed ?? null);
  const [config, setConfig] = useState<AvatarConfig>(() => safeAvatarConfig(profile?.avatar_config, avatarAssets));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeed(profile?.avatar_seed ?? null);
    setConfig(safeAvatarConfig(profile?.avatar_config, avatarAssets));
  }, [profile?.id, profile?.avatar_seed, profile?.avatar_config]);

  if (!user || !profile) return null;
  const effectiveSeed = seed ?? user.id;

  async function save() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await saveMyAvatar(seed, config);
      setSeed(saved.seed);
      setConfig({ selections: saved.selections, colors: saved.colors });
      await refreshProfile(user);
      await queryClient.invalidateQueries();
      setMessage(t("avatarEditor.saved"));
    } catch {
      setError(t("avatarEditor.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container-app mx-auto max-w-5xl space-y-6 py-8">
      <div>
        <Link to="/account/profile" className="text-sm text-primary hover:underline">{t("avatarEditor.back")}</Link>
        <h1 className="mt-2 text-heading-large font-display">{t("avatarEditor.title")}</h1>
        <p className="text-foreground-muted">{t("avatarEditor.description")}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base p-5">
          <div className="mx-auto size-52 overflow-hidden rounded-full" aria-label={t("avatarEditor.preview")}>
            <HumationAvatar assets={avatarAssets} seed={effectiveSeed} selections={config.selections} colors={config.colors}
              background={config.colors.background}
              size="100%" title={t("avatarEditor.preview")} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { setSeed(crypto.randomUUID()); setMessage(null); }}>
              {t("avatarEditor.randomize")}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setSeed(null); setConfig(EMPTY_AVATAR_CONFIG); setMessage(null); }}>
              {t("avatarEditor.reset")}
            </Button>
          </div>
          <p className="text-sm text-foreground-muted">{t("avatarEditor.randomizeHelp")}</p>
        </section>
        <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface-base p-5">
          <h2 className="text-heading-medium font-display">{t("avatarEditor.parts")}</h2>
          <p id="avatar-parts-help" className="text-sm text-foreground-muted">{t("avatarEditor.autoPartHelp")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {avatarAssets.selectionSlots.map((slot) => (
              <div key={slot.id} className="space-y-1.5">
                <Label htmlFor={`avatar-${slot.id}`}>{t(`avatarEditor.slots.${slot.id}` as "avatarEditor.slots.head")}</Label>
                <select id={`avatar-${slot.id}`} aria-describedby="avatar-parts-help" value={config.selections[slot.id] ?? ""}
                  onChange={(event) => setConfig((current) => {
                    const selections = { ...current.selections };
                    if (event.target.value) selections[slot.id] = event.target.value;
                    else delete selections[slot.id];
                    return { ...current, selections };
                  })}
                  className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-foreground">
                  <option value="">{t("avatarEditor.fromSeed")}</option>
                  {getPartsForSlot(avatarAssets, slot.id).map((part) => (
                    <option key={part.id} value={part.name ?? part.id}>{displayPart(part.name ?? part.id)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <h2 className="text-heading-medium font-display">{t("avatarEditor.colors")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {avatarAssets.colors.map((slot) => (
              <div key={slot.id} className="flex items-center gap-3">
                <input id={`color-${slot.id}`} type="color" value={config.colors[slot.id] === "transparent" ? `#${slot.default}` : config.colors[slot.id] ?? `#${slot.default}`}
                  onChange={(event) => setConfig((current) => ({ ...current, colors: { ...current.colors, [slot.id]: event.target.value } }))}
                  className="size-11 cursor-pointer rounded border border-border-subtle" />
                <Label htmlFor={`color-${slot.id}`}>{t(`avatarEditor.colorsBySlot.${slot.id}` as "avatarEditor.colorsBySlot.hair")}</Label>
                {config.colors[slot.id] ? <button type="button" className="text-xs text-primary hover:underline" onClick={() => setConfig((current) => {
                  const colors = { ...current.colors }; delete colors[slot.id]; return { ...current, colors };
                })}>{t("avatarEditor.clear")}</button> : null}
              </div>
            ))}
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-primary">{message}</p> : null}
          <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? t("avatarEditor.saving") : t("avatarEditor.save")}</Button>
        </section>
      </div>
    </main>
  );
}
