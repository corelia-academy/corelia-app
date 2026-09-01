import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FollowerPreviewRow } from "@/lib/follows";
import type { FollowSubject } from "@/types/feed";
import { followersQueryOptions } from "@/features/social/socialQueries";

function followerLabel(row: FollowerPreviewRow): string {
  return row.full_name?.trim() || row.username?.trim() || row.ocid?.trim() || "Corelia";
}

function followerHref(row: FollowerPreviewRow): string {
  const handle = row.username?.trim() || row.ocid?.trim() || row.id;
  return `/@${handle}`;
}

export function FollowerPreview({
  subject,
  totalCount,
  limit = 5,
  className = "",
  showSummary = true,
  open,
  onOpenChange,
}: {
  subject: FollowSubject;
  totalCount?: number | null;
  limit?: number;
  className?: string;
  showSummary?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation("feed");
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  const { type, id } = subject;
  const dialogOpen = open ?? internalDialogOpen;
  const setDialogOpen = onOpenChange ?? setInternalDialogOpen;

  const summaryQuery = useQuery(
    followersQueryOptions({ type, id }, limit, showSummary),
  );
  const items = summaryQuery.data ?? [];

  const count = typeof totalCount === "number" ? totalCount : items.length;
  if (showSummary && count <= 0 && !dialogOpen) return null;

  const dialog = (
    <FollowerListDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      subject={{ type, id }}
      fallbackItems={items}
    />
  );

  if (!showSummary) return dialog;

  return (
    <div className={className}>
      {count > 0 ? (
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          {items.length > 0 ? (
            <AvatarGroup>
              {items.slice(0, limit).map((row) => {
                const label = followerLabel(row);
                return (
                  <NavLink key={row.id} to={followerHref(row)} title={label}>
                    <Avatar size="sm">
                      <AvatarImage src={row.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>{label.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </NavLink>
                );
              })}
              {count > items.length ? (
                <AvatarGroupCount>+{Math.min(count - items.length, 99)}</AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          ) : null}
          <button
            type="button"
            className="font-medium underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => setDialogOpen(true)}
          >
            {t("followers.summary", {
              count,
              defaultValue: "{{count}} followers",
            })}
          </button>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}

function FollowerListDialog({
  open,
  onOpenChange,
  subject,
  fallbackItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: FollowSubject;
  fallbackItems: FollowerPreviewRow[];
}) {
  const { t } = useTranslation("feed");
  const query = useQuery(followersQueryOptions(subject, 50, open));
  const items = query.data ?? [];
  const loading = open && query.isPending;
  const error = query.error instanceof Error
    ? query.error.message
    : query.error ? t("followers.errors.load") : null;
  const visibleItems = items.length > 0 ? items : fallbackItems;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("followers.title")}</DialogTitle>
          <DialogDescription>{t("followers.description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle p-3 text-sm text-foreground-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("followers.loading")}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-border-subtle p-3 text-sm text-destructive">
            {error}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-lg border border-border-subtle p-3 text-sm text-foreground-muted">
            {t("followers.empty")}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <div className="divide-y divide-border-subtle">
              {visibleItems.map((row) => {
                const label = followerLabel(row);
                return (
                  <NavLink
                    key={row.id}
                    to={followerHref(row)}
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
