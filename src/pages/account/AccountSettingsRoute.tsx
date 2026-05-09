import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageSettingsCard } from "./LanguageSettingsCard";

function AccountSettingsSection() {
  const { t } = useTranslation("account");
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { signOut } = useAuth();
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
    <div className="space-y-4">
      <LanguageSettingsCard />
      <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {t("settings.appearance.title")}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("settings.appearance.description")}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border-subtle bg-surface-base p-3">
          <div className="text-xs font-medium text-foreground-muted">
            {t("settings.appearance.themeLabel")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                onClick={() => setTheme(themeOption)}
                className={[
                  "min-h-11 rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  (theme ?? "system") === themeOption
                    ? "border-primary/30 bg-primary-muted text-primary"
                    : "border-border-subtle bg-surface-base text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                ].join(" ")}
              >
                {themeOption === "light"
                  ? t("settings.appearance.light")
                  : themeOption === "dark"
                    ? t("settings.appearance.dark")
                    : t("settings.appearance.system")}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
        <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
            {t("settings.session.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("settings.session.description")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-base p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {t("settings.session.signOutTitle")}
            </div>
            <div className="mt-1 text-sm leading-relaxed text-foreground-muted">
              {t("settings.session.signOutDescription")}
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={signingOut}
            onClick={() => void onSignOut()}
          >
            {t("settings.session.signOutButton")}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function AccountSettingsRoute() {
  return <AccountSettingsSection />;
}

