import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";

export function ContestPublicBadgesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const badges = contest.badges ?? [];
  if (badges.length === 0) return null;

  return (
    <HackathonSectionCard
      id="badges"
      title={t("detail.badges.sectionTitle")}
      description={t("detail.badges.sectionDescription")}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((b) => {
          const img = b.image_url ?? b.imageUrl ?? null;
          return (
            <div
              key={b.id}
              className="flex flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-base"
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
                <div className="text-sm font-medium text-foreground">
                  {b.name}
                </div>
                {b.criteria ? (
                  <div className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {b.criteria}
                  </div>
                ) : null}
                <p className="line-clamp-3 text-xs text-foreground-muted">
                  {b.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </HackathonSectionCard>
  );
}
