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
      <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((b) => {
          const img = b.image_url ?? b.imageUrl ?? null;
          return (
            <div
              key={b.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-base transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-primary/20"
            >
              <div className="aspect-square bg-surface-raised/40 relative overflow-hidden flex items-center justify-center p-5 border-b border-border-subtle/50 group-hover:bg-primary/5 transition-colors duration-300">
                {img?.trim() ? (
                  <img
                    src={img.trim()}
                    alt={b.name}
                    className="max-h-full max-w-full rounded-full border border-border-subtle bg-surface-base shadow-xs object-contain transition-transform duration-500 group-hover:scale-108"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-foreground-muted">
                    {t("detail.badges.noPreview")}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {b.name}
                  </div>
                  {b.criteria ? (
                    <div className="inline-block rounded-full bg-primary/5 text-primary px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wider">
                      {b.criteria}
                    </div>
                  ) : null}
                </div>
                <p className="line-clamp-3 text-xs leading-relaxed text-foreground-muted mt-1">
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
