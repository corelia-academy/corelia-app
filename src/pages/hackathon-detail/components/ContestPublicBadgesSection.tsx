import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

export function ContestPublicBadgesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const badges = contest.badges ?? [];
  if (badges.length === 0) return null;

  return (
    <Card id="badges" className={cn("scroll-mt-36")}>
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("detail.badges.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.badges.sectionDescription")}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((b) => {
            const img = b.image_url ?? b.imageUrl ?? null;
            return (
              <div
                key={b.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-base ring-1 ring-border-subtle"
              >
                <div className="aspect-square bg-surface-raised">
                  {img?.trim() ? (
                    <img
                      src={img.trim()}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-foreground-muted">
                      {t("detail.badges.noPreview")}
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <div className="text-sm font-medium text-foreground">{b.name}</div>
                  {b.criteria ? (
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {b.criteria}
                    </div>
                  ) : null}
                  <p className="line-clamp-3 text-xs text-foreground-muted">{b.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
