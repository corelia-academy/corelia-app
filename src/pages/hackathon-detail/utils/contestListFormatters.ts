import { intlLocale } from "@/lib/intl";
import type { Contest } from "@/types/hackathons";

/** Shared formatters for `Contests` (catalog) vs `InstructorContests` (ops list). */
export type ContestListCopyBundle = "catalog" | "instructor";

export type ContestListTranslateFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

const DATE_KEYS: Record<
  ContestListCopyBundle,
  { unknown: string; startPrefix: string; endPrefix: string }
> = {
  catalog: {
    unknown: "catalog.dateRangeUnknown",
    startPrefix: "catalog.dateStartPrefix",
    endPrefix: "catalog.dateEndPrefix",
  },
  instructor: {
    unknown: "instructor.dateRangeUnknown",
    startPrefix: "instructor.dateStartPrefix",
    endPrefix: "instructor.dateEndPrefix",
  },
};

export function formatContestListDateRange(
  startsAt: string | null,
  endsAt: string | null,
  translate: ContestListTranslateFn,
  bundle: ContestListCopyBundle,
): string {
  const keys = DATE_KEYS[bundle];
  const locale = intlLocale();
  if (!startsAt && !endsAt) return translate(keys.unknown);
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleDateString(locale)} - ${new Date(
      endsAt,
    ).toLocaleDateString(locale)}`;
  }
  if (startsAt) {
    return translate(keys.startPrefix, {
      date: new Date(startsAt).toLocaleDateString(locale),
    });
  }
  return translate(keys.endPrefix, {
    date: new Date(endsAt as string).toLocaleDateString(locale),
  });
}

export function contestListStatusLabel(
  status: Contest["status"],
  translate: ContestListTranslateFn,
  bundle: ContestListCopyBundle,
): string {
  if (bundle === "catalog") {
    return translate(`status.${status}`, {
      defaultValue: translate("status.unknown"),
    });
  }
  switch (status) {
    case "draft":
      return translate("instructor.statusLabel.draft");
    case "published":
      return translate("instructor.statusLabel.published");
    case "running":
      return translate("instructor.statusLabel.running");
    case "ended":
      return translate("instructor.statusLabel.ended");
    default:
      return translate("instructor.statusLabel.unknown");
  }
}

export function contestListLocationLabel(
  loc: Contest["location"],
  translate: ContestListTranslateFn,
  bundle: ContestListCopyBundle,
): string {
  if (bundle === "catalog") {
    return translate(`location.${loc}`, {
      defaultValue: translate("location.unknown"),
    });
  }
  switch (loc) {
    case "online":
      return translate("instructor.locationLabel.online");
    case "offline":
      return translate("instructor.locationLabel.offline");
    case "hybrid":
      return translate("instructor.locationLabel.hybrid");
    default:
      return translate("instructor.locationLabel.unknown");
  }
}
