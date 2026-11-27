import { useState } from "react";
import { Moon, Sun, CircleHalf } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/stores/authStore";
import { useTheme } from "next-themes";
import { setThemeWithTransition } from "@/lib/themeTransition";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageSettingsCard } from "./LanguageSettingsCard";
import { NotificationPreferencesCard } from "./NotificationPreferencesCard";
import { TimeZoneSettingsCard } from "./TimeZoneSettingsCard";
import { SettingsPage, SettingsRow, SettingsSection } from "./SettingsLayout";
import { UsernameSettingsRow } from "./UsernameSettingsRow";
import { QueryErrorState } from "@/components/QueryErrorState";
import { RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { ConnectedAccountsCard } from "./ConnectedAccountsCard";
import ConnectOCIDCard from "./ConnectOCIDCard";
import { EmailSettingsRow, PhoneSettingsRow } from "./ContactSettingsRows";
import { ProfileVisibilitySettingsRow } from "./ProfileVisibilitySettingsRow";

// Cùng bộ icon giao diện với menu avatar ở header.
const THEME_ICONS = { light: Sun, dark: Moon, system: CircleHalf } as const;
const THEME_OPTIONS = ["light", "dark", "system"] as const;

function ThemeSettingsRow() {
  const { t } = useTranslation("account");
  const { theme, setTheme } = useTheme();
  const current = THEME_OPTIONS.find((option) => option === theme) ?? "system";
  const CurrentIcon = THEME_ICONS[current];

  return (
    <SettingsRow
      title={t("settings.appearance.title")}
      description={t("settings.appearance.description")}
      action={
        <div className="w-[200px]">
          <DropdownMenu>
            <DropdownMenuTriggerWithIndicator
              indicatorClassName="[&_svg]:size-5 [&_svg]:text-foreground"
              type="button"
              aria-label={`${t("settings.appearance.title")}: ${t(`settings.appearance.${current}`)}`}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground"
            >
              <CurrentIcon className="size-5 shrink-0 text-foreground-subtle" weight="duotone" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t(`settings.appearance.${current}`)}</span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent layout="multiple-list" align="end" className="w-max min-w-(--anchor-width) max-w-(--available-width)">
              <DropdownMenuList>
                <DropdownMenuRadioGroup value={current} onValueChange={(next) => setThemeWithTransition(setTheme, String(next))}>
                  {THEME_OPTIONS.map((option) => {
                    const Icon = THEME_ICONS[option];
                    return (
                      <DropdownMenuRadioItem key={option} size="large" value={option}>
                        <DropdownMenuItemContent leading={<Icon className="size-5 text-foreground-subtle" weight="duotone" aria-hidden />}>
                          {t(`settings.appearance.${option}`)}
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

function AccountSettingsSection() {
  const { t } = useTranslation("account");
  const navigate = useNavigate();
  const { user, profile, profileLoading, refreshProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      console.error("[account] signOut:", e);
    } finally {
      navigate("/", { replace: true });
      setSigningOut(false);
    }
  };

  return (
    <SettingsPage title={t("nav.settings.title")} subtitle={t("nav.settings.description")}>
      {user && profile ? (
        <>
          <SettingsSection title={t("settings.account.title")}>
            <UsernameSettingsRow />
            <EmailSettingsRow />
            <ChangePasswordCard user={user} />
            <PhoneSettingsRow />
            <ConnectedAccountsCard />
            <ConnectOCIDCard />
          </SettingsSection>
          <SettingsSection title={t("profile.tabs.info")}>
            <ProfileVisibilitySettingsRow />
          </SettingsSection>
        </>
      ) : user ? (
        profileLoading ? (
          <RouteSkeleton variant="form" bare />
        ) : (
          <QueryErrorState message={t("profile.errors.loadFailed")} onRetry={() => void refreshProfile(user)} />
        )
      ) : null}
      <SettingsSection title={t("settings.display.title")}>
        <LanguageSettingsCard />
        <ThemeSettingsRow />
        <TimeZoneSettingsCard />
      </SettingsSection>
      <NotificationPreferencesCard />
      <SettingsSection title={t("settings.session.title")}>
        <SettingsRow
          title={t("settings.session.signOutTitle")}
          description={t("settings.session.signOutDescription")}
          action={
            <Button type="button" variant="destructive" size="small" disabled={signingOut} onClick={() => void onSignOut()}>
              {t("settings.session.signOutButton")}
            </Button>
          }
        />
      </SettingsSection>
    </SettingsPage>
  );
}

export function AccountSettingsRoute() {
  return <AccountSettingsSection />;
}
