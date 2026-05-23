import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";
import { maskEmailAddress } from "@/pages/hackathon-detail/utils/emailMask";

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function PeopleColumn({ title, emails }: { title: string; emails: string[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {emails.map((email) => {
          const initial = email.trim().charAt(0).toUpperCase();
          return (
            <li key={email} className="flex items-center gap-2.5">
              <Avatar size="sm">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <span
                className="text-xs text-foreground-muted tabular-nums"
                title={email}
              >
                {maskEmailAddress(email)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ContestPublicPeopleSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const mentors = uniq(contest.mentor_emails ?? []);
  const judges = uniq(contest.judge_emails ?? []);

  if (mentors.length === 0 && judges.length === 0) return null;

  return (
    <HackathonSectionCard
      id="people"
      eyebrow={t("detail.public.nav.people")}
      title={t("detail.people.sectionTitle")}
      description={t("detail.people.sectionDescription")}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {mentors.length > 0 ? (
          <PeopleColumn title={t("detail.people.mentors")} emails={mentors} />
        ) : null}
        {judges.length > 0 ? (
          <PeopleColumn title={t("detail.people.judges")} emails={judges} />
        ) : null}
      </div>
    </HackathonSectionCard>
  );
}
