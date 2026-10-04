import { MonitorPlay } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

import { ProgressCircle } from "@/components/ui/progress";

import { useHomeXpMissions } from "../hooks/useHomeXpMissions";

type OneTimeStatusKey =
  | "firstHackathonSubmission"
  | "ocidConnected"
  | "githubConnected"
  | "ethereumWallet"
  | "solanaWallet";

type MissionId =
  | "lesson"
  | "quiz"
  | "course"
  | "projectLike"
  | "firstHackathonSubmission"
  | "ocidConnected"
  | "githubConnected"
  | "ethereumWallet"
  | "solanaWallet";

type MissionRow = {
  id: MissionId;
  repeatable: boolean;
  statusKey?: OneTimeStatusKey;
};

const missions: MissionRow[] = [
  { id: "lesson", repeatable: true },
  { id: "quiz", repeatable: true },
  { id: "course", repeatable: true },
  { id: "projectLike", repeatable: true },
  {
    id: "firstHackathonSubmission",
    repeatable: false,
    statusKey: "firstHackathonSubmission",
  },
  { id: "ocidConnected", repeatable: false, statusKey: "ocidConnected" },
  { id: "githubConnected", repeatable: false, statusKey: "githubConnected" },
  { id: "ethereumWallet", repeatable: false, statusKey: "ethereumWallet" },
  { id: "solanaWallet", repeatable: false, statusKey: "solanaWallet" },
];

export function HomeXpMissionsPanel({
  userId,
}: {
  userId: string | undefined;
}) {
  const { t } = useTranslation("common");
  const query = useHomeXpMissions(userId);

  return (
    <section
      className="rounded-2xl border border-border bg-surface-base p-4 shadow-card"
      aria-labelledby="home-xp-missions-title"
    >
      <header className="flex w-full flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <MonitorPlay
            aria-hidden="true"
            className="size-5 shrink-0 text-foreground-muted"
            weight="duotone"
          />
          <h2
            id="home-xp-missions-title"
            className="text-sm font-medium text-foreground"
          >
            {t("home.xpMissions.title")}
          </h2>
        </div>
        <div className="h-px w-full bg-border" />
      </header>

      {query.isPending ? (
        <p role="status" className="py-2 text-xs text-foreground-muted">
          {t("home.xpMissions.loading")}
        </p>
      ) : null}
      {query.isError ? (
        <p role="status" className="py-2 text-xs text-foreground-muted">
          {t("home.xpMissions.statusUnavailable")}
        </p>
      ) : null}

      <ul className="scrollbar-design max-h-[12rem] overflow-y-auto overscroll-contain pr-1">
        {missions.map((mission) => {
          const projectLikesToday = query.data?.projectLikesToday ?? 0;
          const isProjectLike = mission.id === "projectLike";
          const repeatableComplete =
            mission.id === "lesson"
              ? query.data?.lessonCompleted
              : mission.id === "quiz"
                ? query.data?.quizPassed
                : mission.id === "course"
                  ? query.data?.courseCompleted
                  : false;
          const isComplete = mission.statusKey
            ? query.data?.[mission.statusKey] === true
            : isProjectLike
              ? projectLikesToday >= 5
              : repeatableComplete === true;
          const statusLabel = query.isError && !query.data
            ? t("home.xpMissions.statusUnavailable")
            : !query.data
              ? t("home.xpMissions.statusChecking")
              : isComplete
                ? t("home.xpMissions.statusComplete")
                : mission.repeatable
                  ? t("home.xpMissions.repeatable")
                  : t("home.xpMissions.statusNotComplete");

          return (
            <li
              key={mission.id}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-medium leading-5 text-foreground">
                  {t(`home.xpMissions.tasks.${mission.id}.title`)}
                </h3>
                <p className="mt-0.5 text-xs leading-4 text-foreground-muted">
                  {t(`home.xpMissions.tasks.${mission.id}.detail`)}
                </p>
                {mission.id === "projectLike" ? (
                  <p className="mt-0.5 text-xs font-medium text-foreground-muted">
                    {t("home.xpMissions.dailyProgress", {
                      count: query.data?.projectLikesToday ?? 0,
                    })}
                  </p>
                ) : null}
              </div>

              <ProgressCircle
                aria-label={statusLabel}
                className="mt-0.5 size-5"
                colored={isProjectLike && projectLikesToday > 0 && !isComplete}
                colorVariant={isComplete ? "90" : "70"}
                done={isComplete}
                percentage={isProjectLike ? (projectLikesToday / 5) * 100 : 0}
                process={isProjectLike && !isComplete}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
