import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearPendingCredentialsClaimedAt } from "@/lib/profile";
import { profileKeys } from "@/features/auth/profileQueries";
import type { Profile } from "@/types/database";
import { useAuth } from "@/stores/authStore";

/** Shown once, right after login, when private.handle_new_user() has just
 *  converted ghost-minted credentials (granted while this user had no account
 *  yet) into real credential_issuances rows at signup. */
export function PendingCredentialsWelcomeModal() {
  const { profile, user } = useAuth();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const clearMutation = useMutation({
    mutationFn: (userId: string) => clearPendingCredentialsClaimedAt(userId),
    onMutate: (userId) => {
      queryClient.setQueryData<Profile | null>(profileKeys.current(userId), (current) =>
        current ? { ...current, pending_credentials_claimed_at: null } : current,
      );
    },
    onError: (_, userId) => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.current(userId) });
    },
  });

  const open = !dismissed && !!profile?.pending_credentials_claimed_at;

  const clearFlag = async () => {
    setDismissed(true);
    if (!user?.id) return;
    await clearMutation.mutateAsync(user.id).catch(() => undefined);
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
