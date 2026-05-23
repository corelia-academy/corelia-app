import { Button } from "@/components/ui/button";
import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";

export function ContestPublicTrackSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const track =
    contest.tracks?.find((tr) => tr.active !== false) ?? contest.tracks?.[0];
  if (!track?.name?.trim()) return null;

  return (
    <HackathonSectionCard
      id="track"
      eyebrow={t("detail.track.eyebrow")}
      title={track.name}
      description={track.description?.trim() || undefined}
      action={
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled
        >
          {t("detail.track.ctaSoon")}
        </Button>
      }
    />
  );
}
