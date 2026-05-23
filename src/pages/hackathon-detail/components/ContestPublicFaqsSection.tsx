import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";

export function ContestPublicFaqsSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const faqs = contest.faqs ?? [];

  return (
    <HackathonSectionCard id="faq" title={t("detail.faqs.sectionTitle")}>
      {faqs.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("detail.faqs.empty")}</p>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <details
              key={`${faq.question}-${index}`}
              className="group rounded-md border border-border-subtle bg-surface-base px-4 py-3"
            >
              <summary className="cursor-pointer list-none rounded text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  {faq.question}
                  <span
                    className="text-xs text-foreground-muted group-open:rotate-180"
                    aria-hidden
                  >
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
    </HackathonSectionCard>
  );
}
