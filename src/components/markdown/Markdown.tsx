import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({ content, compact }: { content: string; compact?: boolean }) {
  const value = content?.trim();
  if (!value) return null;

  return (
    <div className={compact ? "space-y-2 text-sm leading-relaxed" : "space-y-3 text-sm leading-7 text-foreground-muted"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: (props) => compact
            ? <h3 className="mt-3 text-base font-semibold" {...props} />
            : <h2 className="mt-6 text-xl font-semibold text-foreground" {...props} />,
          h2: (props) => compact
            ? <h4 className="mt-2 text-sm font-semibold" {...props} />
            : <h3 className="mt-5 text-lg font-semibold text-foreground" {...props} />,
          h3: (props) => compact
            ? <h4 className="mt-2 text-sm font-semibold" {...props} />
            : <h4 className="mt-4 text-base font-semibold text-foreground" {...props} />,
          p: (props) => <p className="whitespace-pre-wrap" {...props} />,
          a: (props) => (
            <a className="text-primary underline underline-offset-4 hover:opacity-80" {...props} />
          ),
          ul: (props) => <ul className="list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
          li: (props) => <li className="leading-7" {...props} />,
          code: ({ className, ...props }) => {
            const isBlock = className?.includes("language-");
            return isBlock ? (
              <code className={className} {...props} />
            ) : (
              <code
                className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
                {...props}
              />
            );
          },
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-md border border-border-subtle bg-surface-raised p-3 text-xs leading-6 text-foreground"
              {...props}
            />
          ),
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

