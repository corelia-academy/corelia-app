import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminProfilePreviewQueryOptions } from "@/features/admin/adminQueries";
import { getRoleLabel } from "@/types/database";
import { useAuth } from "@/stores/authStore";

/** Floating preview of a student's public profile — lets an admin visually confirm
 *  they picked the right person before minting, without leaving the manual-mint form. */
export function ManualMintProfilePreviewDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const query = useQuery(adminProfilePreviewQueryOptions(userId, user?.id, open));
  const profile = query.data ?? null;
  const loading = open && Boolean(userId) && query.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("manualMint.preview.title")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-foreground-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("manualMint.preview.loading")}
          </div>
        ) : !profile ? (
          <p className="py-8 text-center text-sm text-foreground-muted">
            {t("manualMint.preview.notFound")}
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{(profile.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profile.full_name || t("manualMint.preview.noName")}
                </p>
                <p className="text-xs text-foreground-muted">
                  {profile.username ? `@${profile.username}` : profile.id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-foreground-muted">{t("manualMint.preview.role")}</p>
                <p className="font-medium">{getRoleLabel(profile.role)}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">{t("manualMint.preview.followers")}</p>
                <p className="font-medium">{profile.follower_count ?? 0}</p>
              </div>
            </div>

            {profile.bio ? (
              <p className="line-clamp-3 text-sm text-foreground-muted">{profile.bio}</p>
            ) : null}

            {profile.username ? (
              <a
                href={`/u/${encodeURIComponent(profile.username)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-primary underline-offset-2 hover:underline"
              >
                {t("manualMint.preview.fullPageLink")}
              </a>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
