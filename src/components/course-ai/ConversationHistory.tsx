import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/markdown/Markdown";
import { cn } from "@/lib/utils";
import type { CoraMessage, CoraSourceRef } from "@/hooks/useCoraAI";

function formatSourceLabel(source: CoraSourceRef | undefined) {
  if (!source) return "";
  const topic = source.topic?.trim() ?? "";
  const subtopic = source.subtopic?.trim() ?? "";
  if (subtopic) return `${topic} · ${subtopic}`;
  return topic;
}

export function ConversationHistory({
  messages,
  isStreaming = false,
  className,
}: {
  messages: CoraMessage[];
  isStreaming?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isStreaming]);

  return (
    <div className={cn("space-y-3 px-4 py-4", className)}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-[1.7] shadow-sm",
            message.role === "user"
              ? "ml-auto bg-primary text-primary-foreground"
              : "mr-auto border border-border-subtle bg-surface-raised text-foreground",
          )}
        >
          {message.role === "user" ? (
            <>
              {message.attachments && message.attachments.length > 0 ? (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {message.attachments.map((att, idx) =>
                    att.kind === "image" ? (
                      <a
                        key={`${message.id}-att-${idx}`}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-md border border-primary-foreground/30"
                      >
                        <img
                          src={att.url}
                          alt="attachment"
                          className="max-h-60 max-w-full object-contain"
                          loading="lazy"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              ) : null}
              {message.content ? (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              ) : null}
            </>
          ) : (
            <>
              <Markdown content={message.content} compact />
              {isStreaming && message === messages[messages.length - 1] ? (
                <span className="mt-1 inline-flex items-center gap-1">
                  <span className="size-1.5 animate-pulse rounded-full bg-current/70" />
                  <span className="size-1.5 animate-pulse rounded-full bg-current/50 [animation-delay:120ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-current/30 [animation-delay:240ms]" />
                </span>
              ) : null}
            </>
          )}
          {message.role === "assistant" && (message.sources?.length ?? 0) > 0 ? (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-foreground-muted">
                {t("coraWidget.sourceCount", { count: message.sources?.length ?? 0 })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {message.sources?.slice(0, 2).map((source, index) => {
                  const label = formatSourceLabel(source);
                  if (!label) return null;
                  return (
                    <span
                      key={`${message.id}-source-${index}`}
                      className="rounded-full border border-border-subtle bg-background/70 px-2 py-0.5 text-[10px] text-foreground-subtle"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
