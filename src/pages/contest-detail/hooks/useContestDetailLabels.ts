import { useCallback } from "react";
import type { Contest, ContestRegistrationStatus } from "@/types/contests";

export function useContestDetailLabels(translate: (key: string, options?: Record<string, unknown>) => string) {
  const statusLabel = useCallback(
    (status: Contest["status"]): string =>
      translate(`status.${status}`, { defaultValue: translate("status.unknown") }),
    [translate],
  );

  const registrationStatusLabel = useCallback(
    (status: ContestRegistrationStatus): string =>
      translate(`registrationStatus.${status}`, {
        defaultValue: translate("registrationStatus.unknown"),
      }),
    [translate],
  );

  const locationLabel = useCallback(
    (loc: Contest["location"]): string =>
      translate(`location.${loc}`, { defaultValue: translate("location.unknown") }),
    [translate],
  );

  return { statusLabel, registrationStatusLabel, locationLabel };
}

