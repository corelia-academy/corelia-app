import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

export function ContestPublicOrganizationalPartnersSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const partners = contest.organizational_partners ?? [];

  return (
    <Card id="partners" className={cn("scroll-mt-36")}>
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("detail.organizationalPartners.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.organizationalPartners.sectionDescription")}
        </p>
        {partners.length === 0 ? (
          <p className="mt-4 text-sm text-foreground-muted">
            {t("detail.organizationalPartners.empty")}
          </p>
        ) : (
          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2">
            {partners.map((partner, index) => (
              <li
                key={`${partner.title}-${index}`}
                className="flex gap-4 rounded-md border border-border-subtle bg-surface-raised p-4"
              >
                {partner.logo_url?.trim() ? (
                  <div className="shrink-0">
                    <img
                      src={partner.logo_url.trim()}
                      alt={partner.title}
                      className="size-14 rounded-md border border-border-subtle bg-surface-base object-contain p-1"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-foreground">{partner.title}</div>
                  {partner.description?.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                      {partner.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
