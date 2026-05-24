import { CheckSquare, FileText, PlayCircle, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LessonFormat } from "@/lib/lessonFormat";

type Props = {
  value: LessonFormat;
  onChange: (value: LessonFormat) => void;
  videoLabel: string;
  articleLabel: string;
  quizLabel?: string;
  practiceLabel?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

export function LessonFormatSelector({
  value,
  onChange,
  videoLabel,
  articleLabel,
  quizLabel,
  practiceLabel,
  hint,
  disabled,
  className,
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Lesson format"
      >
        <Button
          type="button"
          size="sm"
          variant={value === "video" ? "default" : "outline"}
          disabled={disabled}
          className="gap-1.5"
          onClick={() => onChange("video")}
        >
          <PlayCircle className="size-4" aria-hidden />
          {videoLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === "article" ? "default" : "outline"}
          disabled={disabled}
          className="gap-1.5"
          onClick={() => onChange("article")}
        >
          <FileText className="size-4" aria-hidden />
          {articleLabel}
        </Button>
        {quizLabel && (
          <Button
            type="button"
            size="sm"
            variant={value === "quiz" ? "default" : "outline"}
            disabled={disabled}
            className="gap-1.5"
            onClick={() => onChange("quiz")}
          >
            <CheckSquare className="size-4" aria-hidden />
            {quizLabel}
          </Button>
        )}
        {practiceLabel && (
          <Button
            type="button"
            size="sm"
            variant={value === "practice" ? "default" : "outline"}
            disabled={disabled}
            className="gap-1.5"
            onClick={() => onChange("practice")}
          >
            <PenLine className="size-4" aria-hidden />
            {practiceLabel}
          </Button>
        )}
      </div>
      {hint ? <p className="text-xs text-foreground-muted">{hint}</p> : null}
    </div>
  );
}
