import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listUserFollowing, type FollowerPreviewRow } from "@/lib/follows";

function profileLabel(row: FollowerPreviewRow): string {
  return row.full_name?.trim() || row.username?.trim() || row.ocid?.trim() || "Corelia";
}

function profileHref(row: FollowerPreviewRow): string {
  const handle = row.username?.trim() || row.ocid?.trim() || row.id;
  return `/@${handle}`;
}

export function FollowingListDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("feed");
  const [items, setItems] = useState<FollowerPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await listUserFollowing(userId);
        if (!cancelled) setItems(next);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : t("following.errors.load"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, t, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("following.title")}</DialogTitle>
          <DialogDescription>{t("following.description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle p-3 text-sm text-foreground-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("following.loading")}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-border-subtle p-3 text-sm text-destructive">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border-subtle p-3 text-sm text-foreground-muted">
            {t("following.empty")}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <div className="divide-y divide-border-subtle">
              {items.map((row) => {
                const label = profileLabel(row);
                return (
                  <NavLink
                    key={row.id}
                    to={profileHref(row)}
                    className="flex items-center gap-3 py-3 hover:bg-surface-raised"
                    onClick={() => onOpenChange(false)}
                  >
                    <Avatar>
                      <AvatarImage src={row.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>{label.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {label}
                      </div>
                      {row.username || row.ocid ? (
                        <div className="truncate text-xs text-foreground-muted">
                          {row.username ? `@${row.username}` : row.ocid}
                        </div>
                      ) : null}
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
