import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/contests";

export function ContestPublicFaqsSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-medium tracking-tight text-foreground">
          {t("detail.faqs.sectionTitle")}
        </h2>
        {(contest.faqs ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("detail.faqs.empty")}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {(contest.faqs ?? []).map((faq, index) => (
              <details
                key={`${faq.question}-${index}`}
                className="group rounded-2xl border border-border-subtle bg-background px-4 py-3"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-2">
                    {faq.question}
                    <span className="text-xs text-muted-foreground group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
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

