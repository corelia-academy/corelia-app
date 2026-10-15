import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LESSON_IMAGE_TYPES, isValidLessonImage } from "@/lib/lessonImage";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";

/** Uploads an image for the lesson text and hands back Markdown to append to it. */
export function LessonImageInsert({ courseId, onInsert }: { courseId: string; onInsert(markdown: string): void }) {
  const { t } = useLearningTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isValidLessonImage(file)) { toast.error(t("learning.imageInvalid")); return; }
    setBusy(true);
    try {
      const { uploadCourseLessonImage } = await import("@/lib/storage");
      const { url } = await uploadCourseLessonImage(courseId, file);
      onInsert(`![${t("learning.imageDefaultAlt")}](${url})`);
      toast.success(t("learning.imageInserted"));
    } catch {
      toast.error(t("learning.imageUploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept={LESSON_IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <Button type="button" variant="cta" hierarchy="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        <ImagePlus className="size-4" aria-hidden /> {busy ? t("learning.imageUploading") : t("learning.insertImage")}
      </Button>
    </div>
  );
}
