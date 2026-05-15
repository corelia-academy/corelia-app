import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

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
  }, [messages]);

  return (
    <div className={cn("space-y-3 overflow-y-auto px-4 py-4", className)}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
            message.role === "user"
              ? "ml-auto bg-primary text-primary-foreground"
              : "mr-auto border border-border-subtle bg-surface-raised text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && message.role === "assistant" && message === messages[messages.length - 1] ? (
              <span className="ml-1 inline-flex items-center gap-1 align-middle">
                <span className="size-1.5 animate-pulse rounded-full bg-current/70" />
                <span className="size-1.5 animate-pulse rounded-full bg-current/50 [animation-delay:120ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-current/30 [animation-delay:240ms]" />
              </span>
            ) : null}
          </p>
          {message.role === "assistant" && (message.sources?.length ?? 0) > 0 ? (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                {t("coraWidget.sourceCount", { count: message.sources?.length ?? 0 })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {message.sources?.slice(0, 2).map((source, index) => {
                  const label = formatSourceLabel(source);
                  if (!label) return null;
                  return (
                    <span
                      key={`${message.id}-source-${index}`}
                      className="rounded-full border border-border-subtle bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground"
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
