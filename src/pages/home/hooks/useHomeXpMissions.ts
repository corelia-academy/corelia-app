import { useQuery } from "@tanstack/react-query";

import { getMyXpMissionAwards, hasAnyMyXpAward } from "@/lib/xp";

export type HomeXpMissionProgress = {
  lessonCompleted: boolean;
  quizPassed: boolean;
  courseCompleted: boolean;
  firstHackathonSubmission: boolean;
  ocidConnected: boolean;
  githubConnected: boolean;
  ethereumWallet: boolean;
  solanaWallet: boolean;
  projectLikesToday: number;
};

const ONE_OFF_AWARD_KEYS = [
  "first_hackathon_submission",
  "ocid_connected",
  "github_connected",
  "ethereum_wallet",
  "solana_wallet",
];

async function getHomeXpMissionProgress(
  userId: string,
): Promise<HomeXpMissionProgress> {
  // Repeatable sources need "any row" checks; one-off awards and today's likes share one read.
  const [lessonCompleted, quizPassed, courseCompleted, { awardedKeys, projectLikesToday }] =
    await Promise.all([
      hasAnyMyXpAward(userId, "lesson_completed"),
      hasAnyMyXpAward(userId, "quiz_passed"),
      hasAnyMyXpAward(userId, "course_completed"),
      getMyXpMissionAwards(userId, ONE_OFF_AWARD_KEYS),
    ]);

  return {
    lessonCompleted,
    quizPassed,
    courseCompleted,
    firstHackathonSubmission: awardedKeys.has("first_hackathon_submission"),
    ocidConnected: awardedKeys.has("ocid_connected"),
    githubConnected: awardedKeys.has("github_connected"),
    ethereumWallet: awardedKeys.has("ethereum_wallet"),
    solanaWallet: awardedKeys.has("solana_wallet"),
    projectLikesToday,
  };
}

export function useHomeXpMissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["xp", "home-missions", userId],
    queryFn: () => {
      if (!userId) throw new Error("Missing user id");
      return getHomeXpMissionProgress(userId);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
