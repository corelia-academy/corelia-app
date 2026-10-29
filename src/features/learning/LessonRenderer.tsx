import { useCallback, useEffect } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Markdown } from "@/components/markdown/Markdown";
import { YoutubeLessonVideo } from "./YoutubeLessonVideo";
import { getLessonFormat } from "@/lib/lessonFormat";
import { getYoutubeEmbedUrlForLesson } from "@/types/courses";
import { CodeExerciseLesson } from "@/features/code-exercise/CodeExerciseLesson";
import { PracticeLesson } from "./PracticeLesson";
import { QuizLesson } from "./QuizLesson";
import { validateLesson, validateLessonResources } from "./validation";
import type { LessonRendererProps } from "./types";
import type { SectionQuestion } from "@/types/questions";

const FRAME_CLASS = "flex w-full max-w-[880px] flex-col gap-6xl px-4 pb-7xl pt-6xl sm:px-6 md:px-8xl";

export function LessonRenderer(props: LessonRendererProps & { questions?: SectionQuestion[] }) {
  const format = getLessonFormat(props.lesson);
  const { t } = useLearningTranslation();
  if (validateLesson(props.lesson).length || validateLessonResources(props.lesson.resources ?? [], props.lesson.id, "vi", true).length) {
    const alert = <p role="alert" className="rounded-xl border border-border p-6">{t("learning.unavailable")}</p>;
    return props.contentFrame ? <div className={FRAME_CLASS}>{props.contentFrame.header}{alert}</div> : alert;
  }
  switch (format) {
    case "quiz": return <QuizLesson {...props} />;
    case "practice": return <PracticeLesson {...props} />;
    case "code_exercise": return <><Markdown content={props.lesson.code_exercise_locale?.instructions ?? props.lesson.description_markdown ?? ""} /><CodeExerciseLesson {...props} /></>;
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
  const updatingNode = updating && <p role="status" className="rounded-xl border border-border bg-surface-raised p-6 text-foreground-muted">{t("learning.videoUpdating")}</p>;
  const body = <Markdown content={lesson.description_markdown ?? ""} variant={contentFrame ? "lesson" : "default"} />;
  if (contentFrame) {
    return <div className="flex flex-col">
      {videoNode}
      <div className={FRAME_CLASS}>{contentFrame.header}{updatingNode}{contentFrame.resources}{body}</div>
    </div>;
  }
  return <div className="space-y-6">{videoNode}{updatingNode}{body}</div>;
}
