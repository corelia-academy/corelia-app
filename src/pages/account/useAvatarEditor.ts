import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";
import { queryClient } from "@/lib/queryClient";
import { avatarAssets } from "@/lib/avatarAssets";
import { saveMyAvatar } from "@/lib/avatarProfile";
import { safeAvatarConfig, EMPTY_AVATAR_CONFIG, type AvatarConfig } from "../../../shared/avatarConfig";

export function displayPart(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Logic chỉnh avatar dùng chung cho trang `/settings/avatar` và modal trên hồ sơ. */
export function useAvatarEditor() {
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

  async function save(): Promise<boolean> {
    if (!user) return false;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await saveMyAvatar(seed, config);
      setSeed(saved.seed);
      setConfig({ selections: saved.selections, colors: saved.colors });
      await refreshProfile(user);
      void queryClient.invalidateQueries();
      setMessage(t("avatarEditor.saved"));
      return true;
    } catch {
      setError(t("avatarEditor.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    ready: Boolean(user && profile),
    effectiveSeed: seed ?? user?.id ?? "",
    config,
    saving,
    message,
    error,
    save,
    randomize: () => {
      setSeed(crypto.randomUUID());
      setMessage(null);
    },
    reset: () => {
      setSeed(null);
      setConfig(EMPTY_AVATAR_CONFIG);
      setMessage(null);
    },
    setSlot: (slotId: string, value: string) =>
      setConfig((current) => {
        const selections = { ...current.selections };
        if (value) selections[slotId] = value;
        else delete selections[slotId];
        return { ...current, selections };
      }),
    setColor: (slotId: string, value: string) =>
      setConfig((current) => ({ ...current, colors: { ...current.colors, [slotId]: value } })),
    clearColor: (slotId: string) =>
      setConfig((current) => {
        const colors = { ...current.colors };
        delete colors[slotId];
        return { ...current, colors };
      }),
    colorValue: (slotId: string) => {
      const fallback = `#${avatarAssets.colors.find((slot) => slot.id === slotId)?.default ?? "000000"}`;
      const value = config.colors[slotId];
      return value === "transparent" ? fallback : value ?? fallback;
    },
  };
}
