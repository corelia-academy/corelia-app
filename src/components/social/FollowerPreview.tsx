import { useEffect, useState } from "react";
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
import { listFollowers, type FollowerPreviewRow } from "@/lib/follows";
import type { FollowSubject } from "@/types/feed";

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
}: {
  subject: FollowSubject;
  totalCount?: number | null;
  limit?: number;
  className?: string;
}) {
  const { t } = useTranslation("feed");
  const [items, setItems] = useState<FollowerPreviewRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItems, setDialogItems] = useState<FollowerPreviewRow[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { type, id } = subject;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await listFollowers({ type, id }, limit);
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, limit, type]);

  const count = typeof totalCount === "number" ? totalCount : items.length;
  if (count <= 0) return null;

  return (
    <div className={className}>
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
      <FollowerListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subject={{ type, id }}
        fallbackItems={items}
        items={dialogItems}
        setItems={setDialogItems}
        loading={dialogLoading}
        setLoading={setDialogLoading}
        error={dialogError}
        setError={setDialogError}
      />
    </div>
  );
}

function FollowerListDialog({
  open,
  onOpenChange,
  subject,
  fallbackItems,
  items,
  setItems,
  loading,
  setLoading,
  error,
  setError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: FollowSubject;
  fallbackItems: FollowerPreviewRow[];
  items: FollowerPreviewRow[];
  setItems: (items: FollowerPreviewRow[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}) {
  const { t } = useTranslation("feed");
  const subjectType = subject.type;
  const subjectId = subject.id;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    void listFollowers({ type: subjectType, id: subjectId }, 50)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("followers.errors.load"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, setError, setItems, setLoading, subjectId, subjectType, t]);

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
