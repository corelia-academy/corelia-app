import { ChevronDown } from "lucide-react";
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
        <div className="space-y-3.5">
          {faqs.map((faq, index) => (
            <details
              key={`${faq.question}-${index}`}
              className="group rounded-2xl border border-border-subtle bg-surface-base shadow-card px-4.5 py-4 transition-[transform,background-color,border-color,box-shadow] duration-300 open:border-primary/20 open:shadow-xs hover:border-primary/15"
            >
              <summary className="cursor-pointer list-none rounded-lg text-sm font-semibold text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3 select-none">
                  <span className="group-hover:text-primary transition-colors duration-150">{faq.question}</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-foreground-muted transition-transform duration-300 group-open:rotate-180 group-hover:text-primary"
                    aria-hidden
                  />
                </span>
              </summary>
              <div className="mt-3.5 border-t border-border-subtle/50 pt-3.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted animate-fade-in-up">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      )}
    </HackathonSectionCard>
  );
}
