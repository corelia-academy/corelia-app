import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { parseLessonImageRef } from "@/lib/lessonImage";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/imageUrl";
import { CodeBlock } from "./CodeBlock";

function MarkdownImage({ src, alt, lesson = false }: { src?: string; alt: string; lesson?: boolean }) {
  const isRef = parseLessonImageRef(src) !== null;
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    if (!isRef || !src) return;
    let cancelled = false;
    // Lazy: keeps the Supabase client out of the Markdown module graph until a lesson image is shown.
    void import("@/lib/storage").then(({ resolveLessonImageUrl }) => resolveLessonImageUrl(src)).then((url) => { if (!cancelled) setResolved(url); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [isRef, src]);
  const url = isRef ? resolved : src;
  if (!url) return isRef ? <span className="my-3 block aspect-video w-full animate-pulse rounded-lg bg-surface-raised" aria-hidden /> : null;
  return (
    <img
      src={optimizedImageUrl(url, { width: 960, resize: "contain" }) || undefined}
      srcSet={optimizedImageSrcSet(url, 960, { resize: "contain" })}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("my-3 h-auto max-w-full rounded-lg border border-border-subtle", lesson && "max-h-[60vh]")}
    />
  );
}

export function Markdown({ content, compact, variant = "default" }: { content: string; compact?: boolean; variant?: "default" | "lesson" }) {
  const value = content?.trim();
  if (!value) return null;
  const lesson = variant === "lesson" && !compact;

  return (
    <div
      className={cn(
        lesson
          ? "flex flex-col gap-xl text-body-large text-action-text"
          : compact ? "space-y-2 text-sm leading-relaxed" : "space-y-3 text-sm leading-7 text-foreground-muted",
        "[&>h1:first-child]:mt-0 [&>h2:first-child]:mt-0 [&>h3:first-child]:mt-0 [&>h4:first-child]:mt-0",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: (props) => compact
            ? <h3 className="mt-3 text-heading-small font-display" {...props} />
            : lesson
              ? <h2 className="mb-md mt-3xl font-display text-heading-large" {...props} />
              : <h2 className="mt-6 text-heading-medium font-display text-foreground" {...props} />,
          h2: (props) => compact
            ? <h4 className="mt-2 text-heading-small font-display" {...props} />
            : lesson
              ? <h3 className="mb-md mt-3xl font-display text-heading-large" {...props} />
              : <h3 className="mt-5 text-heading-medium font-display text-foreground" {...props} />,
          h3: (props) => compact
            ? <h4 className="mt-2 text-heading-small font-display" {...props} />
            : lesson
              ? <h4 className="mb-md mt-3xl font-display text-heading-small" {...props} />
              : <h4 className="mt-4 text-heading-small font-display text-foreground" {...props} />,
          p: (props) => <p className="whitespace-pre-wrap" {...props} />,
          a: (props) => (
            <a className="text-primary underline underline-offset-4 hover:opacity-80" {...props} />
          ),
          img: ({ src, alt }) => <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt ?? ""} lesson={lesson} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
          li: (props) => <li className={lesson ? undefined : "leading-7"} {...props} />,
          code: ({ className, children }) => {
            const language = (className ?? "").replace("language-", "").toLowerCase().trim();
            if (className?.startsWith("language-")) {
              return (
                <CodeBlock
                  language={language}
                  code={String(children).replace(/\n$/, "")}
                  variant={lesson ? "lesson" : "default"}
                />
              );
            }
            return (
              <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
                {children}
              </code>
            );
          },
          // CodeBlock handles its own container — pre just passes through
          pre: ({ children }) => <>{children}</>,
          blockquote: (props) => (
            <blockquote
              className="border-l-2 border-border-subtle pl-4 italic text-foreground-muted"
              {...props}
            />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
