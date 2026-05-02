import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/contests";

export function ContestPublicPrizesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-medium tracking-tight text-foreground">
          {t("detail.prizes.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("detail.prizes.sectionDescription")}
        </p>
        {(contest.prizes ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("detail.prizes.empty")}</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(contest.prizes ?? []).map((prize, index) => (
              <div
                key={`${prize.rank_label}-${prize.title}-${index}`}
                className="rounded-2xl border border-border-subtle bg-muted/15 p-5"
              >
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {prize.rank_label}
                </div>
                <div className="mt-2 text-base font-semibold text-foreground">{prize.title}</div>
                {prize.value_display ? (
                  <div className="mt-2 text-sm font-medium text-primary">
                    {prize.value_display}
                  </div>
                ) : null}
                {prize.description ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
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

