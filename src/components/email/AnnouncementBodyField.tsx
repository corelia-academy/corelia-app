import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plainTextToAnnouncementHtml } from "@/lib/email/announcementBody";
import { cn } from "@/lib/utils";
import { MarkdownTextarea } from "@/components/ui/markdown-textarea";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  hint?: string;
  previewToggleLabel: string;
  previewBrandedNote?: string;
  rows?: number;
  className?: string;
};

export function AnnouncementBodyField({
  id,
  value,
  onChange,
  label,
  placeholder,
  hint,
  previewToggleLabel,
  previewBrandedNote,
  rows = 10,
  className,
}: Props) {
  const [showPreview, setShowPreview] = useState(false);

  const previewHtml = useMemo(
    () => (value.trim() ? plainTextToAnnouncementHtml(value) : ""),
    [value],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-1.5 px-2 py-1 text-xs text-foreground-muted hover:text-foreground"
          onClick={() => setShowPreview((v) => !v)}
          aria-pressed={showPreview}
          disabled={!value.trim()}
        >
          {showPreview ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
          {previewToggleLabel}
        </Button>
      </div>
      {hint ? <p className="text-xs text-foreground-muted">{hint}</p> : null}
      <MarkdownTextarea
        id={id}
        rows={rows}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        className="w-full"
      />
      {showPreview && previewHtml ? (
        <div className="mt-3 overflow-hidden rounded-md border border-border-subtle bg-[#f5f0eb] p-3">
          {previewBrandedNote ? (
            <p className="mb-2 text-xs text-foreground-muted">{previewBrandedNote}</p>
          ) : null}
          <div className="mx-auto max-w-[520px] overflow-hidden rounded-xl border border-[#ddd7cf] bg-white">
            <div className="bg-[#1e2440] px-6 py-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#f5f0eb]">
                Corelia Academy
              </span>
            </div>
            <div
              className="px-6 py-5 text-sm leading-relaxed text-[#3d4566] [&_p]:mb-3 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
