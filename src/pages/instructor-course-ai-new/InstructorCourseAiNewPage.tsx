import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Loader2,
  Sparkles,
  Wand2,
  Youtube,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";
import {
  applyGeneratedCourse,
  invokeGenerateCourse,
  quoteCourseGeneration,
  type CourseGenerationQuote,
  type GenerateCourseMode,
} from "@/lib/courseGenerator";
import { checkCourseQuota } from "@/lib/courses";
import { useAuth } from "@/stores/authStore";
import { getCourseLevelLabel, type CourseLevel, type SupportedCourseLocale } from "@/types/courses";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";

const modeOptions: Array<{
  value: GenerateCourseMode;
  title: string;
  description: string;
}> = [
  {
    value: "prompt",
    title: "Prompt",
    description: "Mo ta y tuong, AI tao outline course tu dau.",
  },
  {
    value: "youtube_video_list",
    title: "YouTube list",
    description: "Dan tung video URL, AI sap xep thanh bai hoc.",
  },
  {
    value: "youtube_playlist",
    title: "YouTube playlist",
    description: "Nhap playlist va gioi han so video can import.",
  },
];

const levelOptions: CourseLevel[] = ["all", "beginner", "intermediate", "advanced"];

function splitVideoUrls(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 200);
}

function quotaMessage(quote: CourseGenerationQuote | null): string {
  if (!quote) return "Nhap nguon de xem uoc tinh Cora.";
  if (quote.message_balance == null) {
    return `Uoc tinh ${quote.estimated_cost} Cora message. Goi ${quote.tier}.`;
  }
  return `Uoc tinh ${quote.estimated_cost} Cora message. Con lai sau khi tao: ${quote.balance_after ?? 0}.`;
}

export default function InstructorCourseAiNewPage() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [mode, setMode] = useState<GenerateCourseMode>("prompt");
  const [locale, setLocale] = useState<SupportedCourseLocale>("vi");
  const [level, setLevel] = useState<CourseLevel>("all");
  const [sectionsCount, setSectionsCount] = useState(6);
  const [prompt, setPrompt] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [videoUrlsText, setVideoUrlsText] = useState("");
  const [maxVideos, setMaxVideos] = useState(12);
  const [acceptAttribution, setAcceptAttribution] = useState(false);
  const [quote, setQuote] = useState<CourseGenerationQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const videoUrls = useMemo(() => splitVideoUrls(videoUrlsText), [videoUrlsText]);
  const isYoutubeMode = mode !== "prompt";
  const hasRequiredSource =
    mode === "prompt"
      ? prompt.trim().length >= 8
      : mode === "youtube_playlist"
        ? playlistUrl.trim().length > 0
        : videoUrls.length > 0;
  const canGenerate =
    hasRequiredSource &&
    (!isYoutubeMode || acceptAttribution) &&
    !generating &&
    quote?.available !== false;

  useEffect(() => {
    let cancelled = false;
    if (!hasRequiredSource) {
      setQuote(null);
      setQuoteLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      quoteCourseGeneration({ mode, videoUrls, maxVideos, sectionsCount })
        .then((nextQuote) => {
          if (!cancelled) setQuote(nextQuote);
        })
        .catch((err) => {
          if (!cancelled) {
            setQuote(null);
            setError(err instanceof Error ? err.message : "Khong the tinh quota.");
          }
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasRequiredSource, maxVideos, mode, sectionsCount, videoUrls]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!profile?.id) {
      setError("Ban can dang nhap de tao course.");
      return;
    }
    const profileName = profile.full_name?.trim();
    if (!profileName) {
      setError("Vui long cap nhat ho ten trong Account truoc khi tao course.");
      return;
    }
    if (!hasRequiredSource) {
      setError("Nhap nguon tao course truoc da nhe.");
      return;
    }
    if (isYoutubeMode && !acceptAttribution) {
      setError("Can xac nhan ghi nguon YouTube truoc khi tao course tong hop.");
      return;
    }

    setGenerating(true);
    try {
      const quota = await checkCourseQuota("create_course");
      if (!quota.allowed) {
        throw new Error("Ban da cham gioi han tao course cua goi hien tai.");
      }
      const generated = await invokeGenerateCourse({
        mode,
        locale,
        prompt,
        playlistUrl,
        videoUrls,
        maxVideos,
        targetLevel: level,
        sectionsCount,
      });
      const course = await applyGeneratedCourse(generated.course, {
        profileId: profile.id,
        profileName,
        locale,
        level,
        viewer: user,
      });
      toast.success("Da tao draft course bang AI. Tiep tuc chinh sua truoc khi publish.");
      navigate(`/instructor/courses/${course.id}/edit`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Khong the tao course bang AI.";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageContainer>
      <PageSectionCard className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              AI course creator
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Tao draft course tu prompt hoac YouTube
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
              AI chi tao ban nhap gom thong tin course, section va lesson. Ban van can review,
              sua attribution va publish thu cong.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate("/instructor/courses/new")}>
            Tao thu cong
          </Button>
        </div>
      </PageSectionCard>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <form className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]" onSubmit={handleGenerate}>
        <PageSectionCard className="p-6">
          <FieldGroup>
            <Field>
              <FieldLabel>Nguon tao course</FieldLabel>
              <div className="grid gap-3 md:grid-cols-3">
                {modeOptions.map((option) => {
                  const active = mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setMode(option.value);
                        setError(null);
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-primary bg-primary/10 text-foreground shadow-card"
                          : "border-border-subtle bg-surface-base text-foreground hover:bg-surface-raised"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{option.title}</span>
                        {option.value === "prompt" ? (
                          <Wand2 className="size-4" aria-hidden />
                        ) : (
                          <Youtube className="size-4" aria-hidden />
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-foreground-muted">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel>Ngon ngu</FieldLabel>
                <select
                  className={inputClass}
                  value={locale}
                  onChange={(event) => setLocale(event.target.value === "en" ? "en" : "vi")}
                >
                  <option value="vi">Vietnamese</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>Cap do</FieldLabel>
                <select
                  className={inputClass}
                  value={level}
                  onChange={(event) => setLevel(event.target.value as CourseLevel)}
                >
                  {levelOptions.map((item) => (
                    <option key={item} value={item}>
                      {getCourseLevelLabel(item)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel>So section muc tieu</FieldLabel>
                <InputNumber value={sectionsCount} min={3} max={12} onChange={setSectionsCount} />
              </Field>
            </div>

            {mode === "prompt" ? (
              <Field>
                <FieldLabel>Prompt course</FieldLabel>
                <FieldDescription>
                  Vi du: Tao khoa hoc React cho nguoi moi, co project cuoi khoa la dashboard ban hang.
                </FieldDescription>
                <textarea
                  className={`${inputClass} min-h-40 resize-y`}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Mo ta doi tuong hoc, muc tieu, project, cong nghe va phong cach course..."
                />
              </Field>
            ) : mode === "youtube_playlist" ? (
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <Field>
                  <FieldLabel>YouTube playlist URL</FieldLabel>
                  <input
                    className={inputClass}
                    value={playlistUrl}
                    onChange={(event) => setPlaylistUrl(event.target.value)}
                    placeholder="https://www.youtube.com/playlist?list=..."
                  />
                </Field>
                <Field>
                  <FieldLabel>Max videos</FieldLabel>
                  <InputNumber value={maxVideos} min={1} max={200} onChange={setMaxVideos} />
                </Field>
              </div>
            ) : (
              <Field>
                <FieldLabel>YouTube video URLs</FieldLabel>
                <FieldDescription>Moi dong mot URL. He thong se tinh cost theo so video.</FieldDescription>
                <textarea
                  className={`${inputClass} min-h-40 resize-y`}
                  value={videoUrlsText}
                  onChange={(event) => setVideoUrlsText(event.target.value)}
                  placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."}
                />
              </Field>
            )}

            {isYoutubeMode ? (
              <label className="flex gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-4 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={acceptAttribution}
                  onChange={(event) => setAcceptAttribution(event.target.checked)}
                />
                <span>
                  Toi xac nhan course nay tong hop tu YouTube, can giu link nguon va attribution
                  cong khai truoc khi publish.
                </span>
              </label>
            ) : null}
          </FieldGroup>
        </PageSectionCard>

        <aside className="h-fit space-y-4 xl:sticky xl:top-24">
          <PageSectionCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Coins className="size-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Quota preview</h3>
                <p className="text-xs text-foreground-muted">Tinh theo goi Cora hien tai</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-4">
              {quoteLoading ? (
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Dang tinh cost...
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-foreground">
                  {quote?.available === false ? (
                    <AlertTriangle className="mt-0.5 size-4 text-destructive" aria-hidden />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 text-primary" aria-hidden />
                  )}
                  <span>{quotaMessage(quote)}</span>
                </div>
              )}
            </div>

            {quote?.available === false ? (
              <p className="mt-3 text-xs text-destructive">
                Khong du quota de tao course nay. Hay giam so video/section hoac nang goi.
              </p>
            ) : null}
          </PageSectionCard>

          <PageSectionCard className="p-5">
            <h3 className="font-medium text-foreground">Sau khi generate</h3>
            <div className="mt-3 grid gap-2 text-sm text-foreground-muted">
              <p>1. Tao course o trang thai draft.</p>
              <p>2. Them section va lesson tu skeleton AI.</p>
              <p>3. Chuyen sang editor de review/publish.</p>
            </div>
            <Button type="submit" className="mt-5 w-full" size="lg" disabled={!canGenerate}>
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Dang tao...
                </>
              ) : (
                <>
                  Tao draft bang AI
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
          </PageSectionCard>
        </aside>
      </form>
    </PageContainer>
  );
}

function InputNumber({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className={inputClass}
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => {
        const next = Math.max(min, Math.min(max, Number(event.target.value) || min));
        onChange(next);
      }}
    />
  );
}
