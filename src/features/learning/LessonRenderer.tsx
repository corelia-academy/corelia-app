import { useCallback, useEffect, type ReactNode } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Markdown } from "@/components/markdown/Markdown";
import { YoutubeLessonVideo } from "./YoutubeLessonVideo";
import { getLessonFormat } from "@/lib/lessonFormat";
import { getYoutubeEmbedUrlForLesson } from "@/types/courses";
import { CodeExerciseLesson } from "@/features/code-exercise/CodeExerciseLesson";
import { PracticeLesson } from "./PracticeLesson";
import { QuizLesson } from "./QuizLesson";
import { LESSON_MEDIA_MAX_HEIGHT, LessonColumn } from "./lessonLayout";
import { LessonDataError } from "./LessonDataError";
import { validateLesson, validateLessonResources } from "./validation";
import type { LessonRendererProps } from "./types";
import type { SectionQuestion } from "@/types/questions";

const FRAME_CLASS = "flex flex-col gap-6xl pb-7xl pt-6xl";

// Every format sits in the same column; only `media` (the video) escapes it to run edge to edge.
function Framed({ frame, media, children }: { frame?: LessonRendererProps["contentFrame"]; media?: ReactNode; children: ReactNode }) {
  if (!frame) return <>{media}{children}</>;
  return <div className="flex flex-col">
    {media}
    <LessonColumn className={FRAME_CLASS}>{frame.header}{frame.resources}{children}</LessonColumn>
  </div>;
}

export function LessonRenderer(props: LessonRendererProps & { questions?: SectionQuestion[] }) {
  const format = getLessonFormat(props.lesson);
  if (validateLesson(props.lesson).length || validateLessonResources(props.lesson.resources ?? [], props.lesson.id, "vi", true).length) return <LessonDataError />;
  switch (format) {
    case "quiz": return <Framed frame={props.contentFrame}><QuizLesson {...props} /></Framed>;
    case "practice": return <Framed frame={props.contentFrame}><PracticeLesson {...props} /></Framed>;
    case "code_exercise": return <Framed frame={props.contentFrame}><div className="flex flex-col gap-6xl"><Markdown content={props.lesson.code_exercise_locale?.instructions ?? props.lesson.description_markdown ?? ""} variant="lesson" /><CodeExerciseLesson {...props} /></div></Framed>;
    case "video": return <ContentLesson {...props} video />;
    case "article": return <ContentLesson {...props} />;
  }
}
function ContentLesson({ lesson, mode, onAction, onComplete, video = false, contentFrame }: LessonRendererProps & { video?: boolean }) {
  const { t } = useLearningTranslation();
  const complete = useCallback(async () => { if (mode === "learner") await onComplete(); }, [mode,onComplete]);
  const url = video ? getYoutubeEmbedUrlForLesson(lesson) : null;
  const updating = video && !url && !lesson.youtube_url?.trim();
  useEffect(() => { onAction(updating ? null : { label: t("learning.completeContinue"), run: complete }); return () => onAction(null); }, [onAction, complete, t, updating]);
  const videoNode = url && <YoutubeLessonVideo url={url} title={lesson.title} flush={!!contentFrame} />;
  const updatingNode = updating && (
    <div role="status" className="flex aspect-video w-full items-center justify-center border-b border-border bg-surface-raised px-4 text-center text-foreground-muted" style={{ maxHeight: LESSON_MEDIA_MAX_HEIGHT }}>
      {t("learning.videoUpdating")}
    </div>
  );
  const body = <Markdown content={lesson.description_markdown ?? ""} variant="lesson" />;
  if (contentFrame) return <Framed frame={contentFrame} media={videoNode ?? updatingNode}>{body}</Framed>;
  return <div className="space-y-6">{videoNode}{updatingNode}{body}</div>;
}
