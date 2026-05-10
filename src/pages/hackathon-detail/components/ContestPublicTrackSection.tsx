import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

export function ContestPublicTrackSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const track =
    contest.tracks?.find((tr) => tr.active !== false) ?? contest.tracks?.[0];
  if (!track?.name?.trim()) return null;

  return (
    <Card
      id="track"
      className={cn(
        "scroll-mt-36 overflow-hidden border-transparent bg-gradient-to-br from-primary/20 via-primary/10 to-surface-raised",
      )}
    >
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {t("detail.track.eyebrow")}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-foreground">{track.name}</h2>
            {track.description?.trim() ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                {track.description}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 shrink-0"
            disabled
          >
            {t("detail.track.ctaSoon")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
