import { Award, Trophy } from "lucide-react";
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
        <div className="grid gap-4.5 sm:grid-cols-2">
          {prizes.map((prize, index) => {
            const isFirst = index === 0;
            const Icon = isFirst ? Trophy : Award;
            return (
              <div
                key={`${prize.rank_label}-${prize.title}-${index}`}
                className={cn(
                  "relative group rounded-xl border p-5 transition-[transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-[3px] hover:shadow-card flex flex-col gap-1.5 overflow-hidden",
                  isFirst
                    ? "border-warning/30 bg-warning/10 hover:border-warning dark:border-warning/30 dark:bg-warning/10 dark:hover:border-warning/50 shadow-xs"
                    : "border-border-subtle bg-surface-raised hover:border-primary/20",
                )}
              >
                {isFirst ? (
                  <div className="absolute -top-2 -right-2 p-3 text-warning opacity-15 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none">
                    <Trophy className="size-20" />
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex size-8 items-center justify-center rounded-lg shadow-2xs transition-[transform,background-color,border-color,box-shadow] duration-300",
                    isFirst 
                      ? "bg-amber-100 text-warning dark:bg-warning/20 dark:text-warning group-hover:scale-105" 
                      : "bg-primary/5 text-primary group-hover:scale-105"
                  )}>
                    <Icon className="size-4.5" />
                  </div>
                  <div className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isFirst ? "text-warning" : "text-foreground-muted group-hover:text-primary transition-colors"
                  )}>
                    {prize.rank_label}
                  </div>
                </div>

                <div className="mt-2 text-base font-semibold leading-snug text-foreground">
                  {prize.title}
                </div>

                {prize.value_display ? (
                  <div className={cn(
                    "text-lg font-bold tracking-tight mt-1",
                    isFirst ? "text-warning" : "text-primary"
                  )}>
                    {prize.value_display}
                  </div>
                ) : null}

                {prize.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted pt-2.5 border-t border-border-subtle/55">
                    {prize.description}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </HackathonSectionCard>
  );
}

