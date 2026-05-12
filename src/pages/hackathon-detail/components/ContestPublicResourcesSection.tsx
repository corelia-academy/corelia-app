import {
  Calendar,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Play,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  Contest,
  ContestHackathonResource,
  ContestHackathonResourceType,
} from "@/types/hackathons";
import { cn } from "@/lib/utils";

function resourceIcon(type: ContestHackathonResourceType) {
  switch (type) {
    case "livestream":
      return Radio;
    case "video":
      return Play;
    case "image":
      return ImageIcon;
    case "document":
      return FileText;
    case "event":
      return Calendar;
    default:
      return ExternalLink;
  }
}

export function ContestPublicResourcesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const list = contest.resources ?? [];
  if (list.length === 0) return null;

  const now = Date.now();
  const featured = list.filter((r) => {
    if (r.type !== "livestream") return r.pinned;
    const startRaw = r.starts_at ?? r.startsAt ?? "";
    const endRaw = r.ends_at ?? r.endsAt ?? "";
    const s = startRaw ? new Date(startRaw).getTime() : NaN;
    const e = endRaw ? new Date(endRaw).getTime() : NaN;
    if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
    return now >= s && now <= e;
  });

  const rest = list.filter((r) => !featured.includes(r));

  const ResourceCard = ({ r }: { r: ContestHackathonResource }) => {
    const Icon = resourceIcon(r.type);
    const thumb = r.thumbnail_url ?? r.thumbnailUrl ?? null;
    return (
      <div className="flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
        {thumb?.trim() ? (
          <div className="relative aspect-video w-full bg-surface-raised">
            <img src={thumb.trim()} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
              {r.title}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-auto w-full"
            nativeButton={false}
            render={
              <a href={r.url} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("detail.resources.open")}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card id="resources" className={cn("scroll-mt-36")}>
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("detail.resources.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.resources.sectionDescription")}
        </p>

        {featured.length > 0 ? (
          <div className="mt-6 space-y-3">
            {featured.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {t("detail.resources.live")}
                  </span>
                  <span className="text-sm font-medium text-foreground">{r.title}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  nativeButton={false}
                  render={
                    <a href={r.url} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  {t("detail.resources.watchLive")}
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((r) => (
            <ResourceCard key={r.id} r={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
