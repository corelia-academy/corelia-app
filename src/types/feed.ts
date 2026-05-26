export type FollowSubjectType = "user" | "course" | "hackathon" | "project";

export interface FollowSubject {
  type: FollowSubjectType;
  id: string;
}

export interface FollowRow {
  follower_id: string;
  subject_type: FollowSubjectType;
  subject_id: string;
  created_at: string;
  muted_until: string | null;
}

export type ActivityVisibility = "public" | "followers" | "private";

export interface ActivityEvent {
  id: number;
  actor_id: string;
  verb: string;
  object_type: string;
  object_id: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  visibility: ActivityVisibility;
  created_at: string;
}
