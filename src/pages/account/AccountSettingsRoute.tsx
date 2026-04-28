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

  const onSignOut = () => {
    void signOut();
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <LanguageSettingsCard />
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-foreground">
              {t("settings.appearance.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.appearance.description")}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border-subtle bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {t("settings.appearance.themeLabel")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                onClick={() => setTheme(themeOption)}
                className={[
                  "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                  (theme ?? "system") === themeOption
                    ? "border-primary/25 bg-primary-container text-on-primary-container shadow-card"
                    : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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

      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-foreground">
            {t("settings.session.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings.session.description")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-background p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {t("settings.session.signOutTitle")}
            </div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("settings.session.signOutDescription")}
            </div>
          </div>
          <Button type="button" variant="destructive" onClick={onSignOut}>
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

