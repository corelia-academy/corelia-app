import * as React from "react";
import { Bold, Italic, Link2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MarkdownTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onValueChange?: (value: string) => void;
}

export const MarkdownTextarea = React.forwardRef<HTMLTextAreaElement, MarkdownTextareaProps>(
  ({ className, value, onValueChange, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement>).current = node;
        }
      },
      [ref]
    );

    const insertText = (prefix: string, suffix: string = "") => {
      const textarea = internalRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      const before = text.substring(0, start);
      const selection = text.substring(start, end);
      const after = text.substring(end);

      const newText = `${before}${prefix}${selection}${suffix}${after}`;
      
      // Update value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      nativeInputValueSetter?.call(textarea, newText);
      const event = new Event("input", { bubbles: true });
      textarea.dispatchEvent(event);

      if (onValueChange) {
        onValueChange(newText);
      }

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    };

    const handleToolbarClick = (e: React.MouseEvent, prefix: string, suffix: string = "") => {
      e.preventDefault();
      insertText(prefix, suffix);
    };

    return (
      <div className={cn("flex flex-col border border-border rounded-md overflow-hidden bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", className)}>
        <div className="flex items-center gap-1 border-b border-border bg-muted/50 p-1">
          <button
            type="button"
            className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded"
            onClick={(e) => handleToolbarClick(e, "**", "**")}
            title="In đậm (Bold)"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded"
            onClick={(e) => handleToolbarClick(e, "*", "*")}
            title="In nghiêng (Italic)"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded"
            onClick={(e) => handleToolbarClick(e, "[", "](url)")}
            title="Chèn Link"
          >
            <Link2 size={16} />
          </button>
        </div>
        <textarea
          ref={setRefs}
          value={value}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          className="flex min-h-[120px] w-full resize-y bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
      </div>
    );
  }
);

MarkdownTextarea.displayName = "MarkdownTextarea";
