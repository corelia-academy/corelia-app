import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

export function ContestPublicPrizesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const prizes = contest.prizes ?? [];

  return (
    <HackathonSectionCard
      id="prizes"
      eyebrow={t("detail.public.nav.prizes")}
      title={t("detail.prizes.sectionTitle")}
      description={t("detail.prizes.sectionDescription")}
    >
      {prizes.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("detail.prizes.empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {prizes.map((prize, index) => (
            <div
              key={`${prize.rank_label}-${prize.title}-${index}`}
              className={cn(
                "rounded-md border p-4",
                index === 0
                  ? "border-primary/20 bg-primary/5"
                  : "border-border-subtle bg-surface-raised",
              )}
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {prize.rank_label}
              </div>
              <div className="mt-2 text-base font-semibold text-foreground">
                {prize.title}
              </div>
              {prize.value_display ? (
                <div className="mt-2 text-sm font-medium text-primary">
                  {prize.value_display}
                </div>
              ) : null}
              {prize.description ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
                  {prize.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </HackathonSectionCard>
  );
}

