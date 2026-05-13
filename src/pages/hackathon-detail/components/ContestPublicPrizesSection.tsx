import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

export function ContestPublicPrizesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;

  return (
    <Card id="prizes" className={cn("scroll-mt-36")}>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          {t("detail.public.nav.prizes")}
        </div>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          {t("detail.prizes.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.prizes.sectionDescription")}
        </p>
        {(contest.prizes ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-foreground-muted">{t("detail.prizes.empty")}</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(contest.prizes ?? []).map((prize, index) => (
              <div
                key={`${prize.rank_label}-${prize.title}-${index}`}
                className={cn(
                  "rounded-md border p-4",
                  index === 0
                    ? "border-primary/30 bg-primary/5"
                    : index === 1
                      ? "border-border bg-surface-raised"
                      : "border-border-subtle bg-surface-raised",
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {prize.rank_label}
                </div>
                <div className="mt-2 text-base font-semibold text-foreground">{prize.title}</div>
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
      </CardContent>
    </Card>
  );
}

