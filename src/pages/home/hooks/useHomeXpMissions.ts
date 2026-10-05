import { useQuery } from "@tanstack/react-query";

import {
  getTodayLikeXpRemaining,
  hasAnyMyXpAward,
  hasMyXpAward,
} from "@/lib/xp";

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

async function getHomeXpMissionProgress(
  userId: string,
): Promise<HomeXpMissionProgress> {
  const [
    lessonCompleted,
    quizPassed,
    courseCompleted,
    firstHackathonSubmission,
    ocidConnected,
    githubConnected,
    ethereumWallet,
    solanaWallet,
    projectLikesRemaining,
  ] = await Promise.all([
    hasAnyMyXpAward(userId, "lesson_completed"),
    hasAnyMyXpAward(userId, "quiz_passed"),
    hasAnyMyXpAward(userId, "course_completed"),
    hasMyXpAward("first_hackathon_submission"),
    hasMyXpAward("ocid_connected"),
    hasMyXpAward("github_connected"),
    hasMyXpAward("ethereum_wallet"),
    hasMyXpAward("solana_wallet"),
    getTodayLikeXpRemaining(userId),
  ]);

  return {
    lessonCompleted,
    quizPassed,
    courseCompleted,
    firstHackathonSubmission,
    ocidConnected,
    githubConnected,
    ethereumWallet,
    solanaWallet,
    projectLikesToday: Math.max(0, 5 - projectLikesRemaining),
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
