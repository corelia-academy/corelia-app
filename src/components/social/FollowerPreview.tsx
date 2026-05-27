import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { listFollowers, type FollowerPreviewRow } from "@/lib/follows";
import type { FollowSubject } from "@/types/feed";

function followerLabel(row: FollowerPreviewRow): string {
  return row.full_name?.trim() || row.username?.trim() || row.ocid?.trim() || "Corelia";
}

function followerHref(row: FollowerPreviewRow): string {
  const handle = row.username?.trim() || row.ocid?.trim() || row.id;
  return `/u/${handle}`;
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
        <span>
          {t("followers.summary", {
            count,
            defaultValue: "{{count}} followers",
          })}
        </span>
      </div>
    </div>
  );
}
