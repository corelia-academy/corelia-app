import { useState } from "react";
import { Globe, Lock } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { updateProfileForUser } from "@/lib/profile";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/stores/authStore";
import { SettingsRow } from "./SettingsLayout";

const VISIBILITY_ICONS = { public: Globe, private: Lock } as const;
const VISIBILITY_OPTIONS = ["public", "private"] as const;

export function ProfileVisibilitySettingsRow() {
  const { t } = useTranslation("account");
  const { user, profile, refreshProfile } = useAuth();
  // Giá trị tạm trong lúc lưu để dropdown đổi ngay; lưu xong hoặc lỗi thì đọc lại từ hồ sơ
  const [pending, setPending] = useState<boolean | null>(null);
  const isPublic = pending ?? profile?.profile_public ?? true;
  const current = isPublic ? "public" : "private";
  const CurrentIcon = VISIBILITY_ICONS[current];
  const handle = profile?.username?.trim() || profile?.ocid?.trim() || profile?.id || "";

  async function onChange(nextPublic: boolean) {
    if (!user || pending !== null || nextPublic === isPublic) return;
    setPending(nextPublic);
    try {
      await updateProfileForUser(user, { profile_public: nextPublic });
      await refreshProfile(user);
      void queryClient.invalidateQueries({ queryKey: ["xp"] });
      toast.success(t("profile.success.visibilityUpdated"));
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("profile.errors.visibilityUpdateFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <SettingsRow
      title={t("settings.visibility.title")}
      description={t("profile.publicProfile.hint", { handle })}
      action={
        <div className="w-[200px]">
          <DropdownMenu>
            <DropdownMenuTriggerWithIndicator
              indicatorClassName="[&_svg]:size-5 [&_svg]:text-foreground"
              type="button"
              disabled={pending !== null}
              aria-label={`${t("settings.visibility.title")}: ${t(`profile.publicProfile.status.${current}`)}`}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground disabled:opacity-50"
            >
              <CurrentIcon className="size-5 shrink-0 text-foreground-subtle" weight="duotone" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t(`profile.publicProfile.status.${current}`)}</span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent layout="multiple-list" align="end" className="w-max min-w-(--anchor-width) max-w-(--available-width)">
              <DropdownMenuList>
                <DropdownMenuRadioGroup value={current} onValueChange={(next) => void onChange(next === "public")}>
                  {VISIBILITY_OPTIONS.map((option) => {
                    const Icon = VISIBILITY_ICONS[option];
                    return (
                      <DropdownMenuRadioItem key={option} size="large" value={option}>
                        <DropdownMenuItemContent leading={<Icon className="size-5 text-foreground-subtle" weight="duotone" aria-hidden />}>
                          {t(`profile.publicProfile.status.${option}`)}
                        </DropdownMenuItemContent>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuList>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );
}
