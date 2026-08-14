import { callCoreliaApi } from "./coreliaEdgeApi";

export type BlastEmailResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  reason?: string;
  skipped_breakdown?: {
    optedOut: number;
    noEmail: number;
    duplicateEmail: number;
  };
};

export async function blastCourseEmail(
  courseId: string,
  params: { subject: string; html: string },
): Promise<BlastEmailResult> {
  return callCoreliaApi<BlastEmailResult>("courses.blastEmail", {
    course_id: courseId,
    subject: params.subject,
    html: params.html,
  });
}

export async function blastCareerTrackEmail(
  trackId: string,
  params: { subject: string; html: string },
): Promise<BlastEmailResult> {
  return callCoreliaApi<BlastEmailResult>("careerTracks.blastEmail", {
    track_id: trackId,
    subject: params.subject,
    html: params.html,
  });
}
