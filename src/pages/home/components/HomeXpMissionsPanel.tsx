import { MonitorPlay } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Action } from "@/components/ui/action";
import { ProgressCircle } from "@/components/ui/progress";
import { useAuth } from "@/stores/authStore";

import { useHomeUserDashboard } from "../hooks/useHomeUserDashboard";
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

type MissionTarget = { to: string; scrollTo?: string };
type MissionContext = { recentCoursePath: string | null };

type MissionRow = {
  id: MissionId;
  repeatable: boolean;
  statusKey?: OneTimeStatusKey;
  getTarget: (ctx: MissionContext) => MissionTarget;
};

const ACCOUNT_PROFILE = "/account/profile";
const toRecentCourse = ({ recentCoursePath }: MissionContext): MissionTarget => ({
  to: recentCoursePath ?? "/courses",
});

const missions: MissionRow[] = [
  { id: "lesson", repeatable: true, getTarget: toRecentCourse },
  { id: "quiz", repeatable: true, getTarget: () => ({ to: "/courses" }) },
  { id: "course", repeatable: true, getTarget: () => ({ to: "/courses" }) },
  { id: "projectLike", repeatable: true, getTarget: () => ({ to: "/projects" }) },
  {
    id: "firstHackathonSubmission",
    repeatable: false,
    statusKey: "firstHackathonSubmission",
    getTarget: () => ({ to: "/hackathons" }),
  },
  {
    id: "ocidConnected",
    repeatable: false,
    statusKey: "ocidConnected",
    getTarget: () => ({ to: ACCOUNT_PROFILE, scrollTo: "connect-ocid" }),
  },
  {
    id: "githubConnected",
    repeatable: false,
    statusKey: "githubConnected",
    getTarget: () => ({ to: ACCOUNT_PROFILE, scrollTo: "connected-github" }),
  },
  {
    id: "ethereumWallet",
    repeatable: false,
    statusKey: "ethereumWallet",
    getTarget: () => ({ to: ACCOUNT_PROFILE, scrollTo: "connected-ethereum" }),
  },
  {
    id: "solanaWallet",
    repeatable: false,
    statusKey: "solanaWallet",
    getTarget: () => ({ to: ACCOUNT_PROFILE, scrollTo: "connected-solana" }),
  },
];

export function HomeXpMissionsPanel({
  userId,
}: {
  userId: string | undefined;
}) {
  const { t } = useTranslation("common");
  const query = useHomeXpMissions(userId);
  const { user } = useAuth();
  const dashboard = useHomeUserDashboard(user, t);
  const recentCoursePath =
    dashboard.focusCards.find((card) => !card.completed && card.progress < 100)?.action ?? null;

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

          const target = mission.getTarget({
            // Chỉ vào chi tiết khi đã biết trạng thái và nhiệm vụ chưa xong.
            // Đã xong hoặc chưa biết thì về trang chính của nhiệm vụ.
            recentCoursePath: query.data && !isComplete ? recentCoursePath : null,
          });

          return (
            <li key={mission.id}>
              <Action
                nativeButton={false}
                render={
                  <Link
                    to={target.to}
                    state={target.scrollTo ? { scrollTo: target.scrollTo } : undefined}
                  />
                }
                label={
                  <>
                    <span className="block whitespace-normal group-hover/action:text-foreground">
                      {t(`home.xpMissions.tasks.${mission.id}.title`)}
                    </span>
                    <span className="mt-0.5 block whitespace-normal text-xs leading-4 text-foreground-muted">
                      {t(`home.xpMissions.tasks.${mission.id}.detail`)}
                    </span>
                    {isProjectLike ? (
                      <span className="mt-0.5 block whitespace-normal text-xs font-medium leading-4 text-foreground-muted">
                        {t("home.xpMissions.dailyProgress", {
                          count: projectLikesToday,
                        })}
                      </span>
                    ) : null}
                  </>
                }
                trailingGroup={
                  <ProgressCircle
                    aria-label={statusLabel}
                    className="mt-0.5 size-5"
                    colored={isProjectLike && projectLikesToday > 0 && !isComplete}
                    colorVariant={isComplete ? "90" : "70"}
                    done={isComplete}
                    percentage={isProjectLike ? (projectLikesToday / 5) * 100 : 0}
                    process={isProjectLike && !isComplete}
                  />
                }
                size="small"
                isActive={false}
                showActive={false}
                className="cursor-pointer items-start px-0! py-2.5! hover:bg-transparent data-[active=true]:bg-transparent"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
