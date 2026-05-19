import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  invokeGenerateDescription,
  type DescriptionGeneratorTargetField,
  type DescriptionGeneratorType,
  type DescriptionSource,
  type GenerateDescriptionRequest,
} from "@/lib/descriptionGenerator";
import type { SupportedCourseLocale } from "@/types/courses";

export type DescriptionGeneratorSourcePreview = {
  id: string;
  title: string;
  sourceKinds: Array<"short_description" | "description_markdown" | "transcript" | "missing">;
  snippet?: string;
};

export type DescriptionGeneratorDialogRequest = {
  title: string;
  description: string;
  type: DescriptionGeneratorType;
  targetField: DescriptionGeneratorTargetField;
  locale: SupportedCourseLocale;
  sourcePreviews: DescriptionGeneratorSourcePreview[];
  warning?: string | null;
  actionLabel?: string;
  loadingLabel?: string;
  requestBody: GenerateDescriptionRequest;
  onApply: (value: string) => void;
};

type Props = {
  open: boolean;
  request: DescriptionGeneratorDialogRequest | null;
  onOpenChange: (open: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function sourceKindLabel(
  kind: DescriptionGeneratorSourcePreview["sourceKinds"][number],
  t: Props["t"],
): string {
  if (kind === "short_description") return t("courseEdit.descriptionGenerator.sourceKinds.shortDescription");
  if (kind === "description_markdown") return t("courseEdit.descriptionGenerator.sourceKinds.longDescription");
  if (kind === "transcript") return t("courseEdit.descriptionGenerator.sourceKinds.transcript");
  return t("courseEdit.descriptionGenerator.sourceKinds.missing");
}

function normalizePreviewSources(
  request: DescriptionGeneratorDialogRequest | null,
  responseSources: DescriptionSource[] | null,
): DescriptionGeneratorSourcePreview[] {
  if (!request) return [];
  if (!responseSources?.length) return request.sourcePreviews;
  return responseSources.map((source) => ({
    id: source.lessonId,
    title: source.lessonTitle,
    sourceKinds: source.sourceKinds.length ? source.sourceKinds : ["missing"],
    snippet: source.snippet,
  }));
}

export function DescriptionGeneratorDialog({
  open,
  request,
  onOpenChange,
  t,
}: Props) {
  const [generatedValue, setGeneratedValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseSources, setResponseSources] = useState<DescriptionSource[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setGeneratedValue("");
    setLoading(false);
    setError(null);
    setResponseSources(null);
    setWarning(request?.warning ?? null);
  }, [open, request]);

  const sources = useMemo(
    () => normalizePreviewSources(request, responseSources),
    [request, responseSources],
  );
  const hasUsableSources = useMemo(
    () => sources.some((source) => !source.sourceKinds.includes("missing")),
    [sources],
  );

  const handleGenerate = async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      const response = await invokeGenerateDescription(request.requestBody);
      setGeneratedValue(response.description);
      setResponseSources(response.sources);
      setWarning(response.warning ?? request.warning ?? null);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : t("courseEdit.descriptionGenerator.errors.generic"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
            <p className="text-sm font-medium text-foreground">
              {t("courseEdit.descriptionGenerator.sourcesTitle")}
            </p>
            <div className="mt-3 space-y-3">
              {sources.length ? (
                sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-md border border-border-subtle bg-surface-base p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{source.title}</p>
                      {source.sourceKinds.map((kind) => (
                        <span
                          key={`${source.id}-${kind}`}
                          className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-foreground-muted"
                        >
                          {sourceKindLabel(kind, t)}
                        </span>
                      ))}
                    </div>
                    {source.snippet ? (
                      <p className="mt-2 text-sm text-foreground-muted">{source.snippet}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground-muted">
                  {t("courseEdit.descriptionGenerator.emptySources")}
                </p>
              )}
            </div>
            {warning ? (
              <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                {warning}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {t("courseEdit.descriptionGenerator.previewTitle")}
              </p>
              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={loading || !hasUsableSources}
                className="inline-flex items-center gap-2"
              >
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                {loading
                  ? request?.loadingLabel ?? t("courseEdit.descriptionGenerator.generating")
                  : request?.actionLabel ?? t("courseEdit.descriptionGenerator.generate")}
              </Button>
            </div>
            {error ? (
              <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <textarea
              value={generatedValue}
              onChange={(event) => setGeneratedValue(event.target.value)}
              placeholder={t("courseEdit.descriptionGenerator.previewPlaceholder")}
              className="mt-3 min-h-[220px] w-full rounded border border-border bg-surface-base px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              rows={10}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("courseEdit.descriptionGenerator.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!generatedValue.trim()}
            onClick={() => {
              if (!request || !generatedValue.trim()) return;
              request.onApply(generatedValue);
              onOpenChange(false);
            }}
          >
            {t("courseEdit.descriptionGenerator.useDescription")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
