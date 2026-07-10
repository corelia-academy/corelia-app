import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

/** Shown once, right after login, when private.handle_new_user() has just
 *  converted ghost-minted credentials (granted while this user had no account
 *  yet) into real credential_issuances rows at signup. */
export function PendingCredentialsWelcomeModal() {
  const { profile, user } = useAuth();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const open = !dismissed && !!profile?.pending_credentials_claimed_at;

  const clearFlag = async () => {
    setDismissed(true);
    if (!user?.id) return;
    await supabase
      .from("profiles")
      .update({ pending_credentials_claimed_at: null })
      .eq("id", user.id)
      .then(
        () => {},
        () => {},
      );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void clearFlag(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>{t("pendingCredentialsWelcome.title")}</DialogTitle>
          <DialogDescription>{t("pendingCredentialsWelcome.body")}</DialogDescription>
        </DialogHeader>
        <Button
          className="mt-2 w-full"
          onClick={() => {
            void clearFlag();
            navigate("/achievements");
          }}
        >
          {t("pendingCredentialsWelcome.cta")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
