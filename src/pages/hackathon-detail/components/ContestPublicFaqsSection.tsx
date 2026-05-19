import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

export function ContestPublicFaqsSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;

  return (
    <Card id="faq" className={cn("scroll-mt-36")}>
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("detail.faqs.sectionTitle")}
        </h2>
        {(contest.faqs ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-foreground-muted">{t("detail.faqs.empty")}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {(contest.faqs ?? []).map((faq, index) => (
              <details
                key={`${faq.question}-${index}`}
                className="group rounded-md border border-border-subtle bg-surface-base px-4 py-3"
              >
                <summary className="cursor-pointer list-none rounded text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-2">
                    {faq.question}
                    <span className="text-xs text-foreground-muted group-open:rotate-180" aria-hidden>
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

