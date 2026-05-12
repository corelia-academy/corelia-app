import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { CoraMessage } from "@/hooks/useCoraAI";

export function ConversationHistory({
  messages,
  isStreaming = false,
  className,
}: {
  messages: CoraMessage[];
  isStreaming?: boolean;
  className?: string;
}) {
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
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
