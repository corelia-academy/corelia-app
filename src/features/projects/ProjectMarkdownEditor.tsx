import { Bold, Code, Heading2, Italic, Link, List } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/markdown/Markdown";
import { Input } from "@/components/ui/input";
import { Tabs, TabsGroup } from "@/components/ui/tabs";

export function ProjectMarkdownEditor({ label, value, onChange, maxLength, required, placeholder, hint, rows = 10, variant = "markdown", layout = "stacked", compactCounter = false }: {
  label: string; value: string; onChange: (value: string) => void; maxLength: number;
  required: boolean; placeholder: string; hint?: string; rows?: number;
  variant?: "markdown" | "plain"; layout?: "stacked" | "row";
  compactCounter?: boolean;
}) {
  const { t } = useTranslation("common");
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState("write");
  const actions = [
    { key: "heading", icon: Heading2, before: "## ", after: "", line: true },
    { key: "bold", icon: Bold, before: "**", after: "**" },
    { key: "italic", icon: Italic, before: "*", after: "*" },
    { key: "list", icon: List, before: "- ", after: "", line: true },
    { key: "link", icon: Link, before: "[", after: "](https://)" },
    { key: "code", icon: Code, before: "`", after: "`" },
  ] as const;
  function format(action: typeof actions[number]) {
    const input = textarea.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = value.slice(start, end) || t("projects.editor.markdownText");
    const before = ("line" in action && start > 0 && value[start - 1] !== "\n" ? "\n" : "") + action.before;
    const next = value.slice(0, start) + before + selected + action.after + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }
  const describedBy = `${id}-limit${hint ? ` ${id}-hint` : ""}`;
  const counter = <span id={`${id}-limit`} className="pointer-events-none absolute bottom-2 right-3 text-body-small font-body text-foreground-muted">{t(compactCounter ? "projects.editor.submissionCharacterLimit" : "projects.editor.characterLimit", { count: value.length, limit: maxLength })}</span>;
  return <div className={layout === "row" ? "grid min-w-0 gap-3 border-b border-border-subtle py-5 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(9rem,1fr)_minmax(0,2fr)] lg:gap-6" : "min-w-0"}>
    <div>
      <label htmlFor={id} className={`text-label-medium font-body${compactCounter ? " leading-[1.4] tracking-[-0.07px]" : ""}${layout === "row" ? " lg:block lg:pt-2" : ""}`}>{label}{required ? <span className="text-error-400"> *</span> : null}</label>
      {hint ? <p id={`${id}-hint`} className="mt-2 text-body-small text-foreground-muted">{hint}</p> : null}
    </div>
    <div className="min-w-0">
      {variant === "plain" ? (
        <div className={compactCounter ? "mt-1.5" : "mt-2"}>
          <Input ref={textarea} fieldType="auto-grow" submitOnEnter={false} id={id} required={required} aria-describedby={describedBy} rows={rows} maxLength={maxLength} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} controlClassName={compactCounter ? "h-[154px] min-h-[154px] max-h-[154px] overflow-hidden" : undefined} className={compactCounter ? "h-full min-h-full max-h-full overflow-y-auto pb-5" : "min-h-40"} renderTrailingContent={compactCounter ? () => counter : undefined} />
        </div>
      ) : (
        <Tabs.Root value={mode} onValueChange={value => setMode(String(value))} className="mt-2 overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
            <TabsGroup level="2b" className="shrink-0">
              <Tabs.List aria-label={`${label}: Markdown`}>
                {(["write", "preview"] as const).map(tab => <Tabs.Tab key={tab} value={tab}>{t(`projects.editor.${tab}`)}</Tabs.Tab>)}
              </Tabs.List>
            </TabsGroup>
            {mode === "write" ? (
              <div role="group" aria-label={t("projects.editor.formatting")} className="flex min-w-0 grow basis-[max-content] flex-nowrap justify-end gap-1">
                {actions.map(action => <button key={action.key} type="button" onClick={() => format(action)} title={t(`projects.editor.markdown${action.key}`)} aria-label={t(`projects.editor.markdown${action.key}`)} className="flex size-10 items-center justify-center rounded-md hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"><action.icon className="size-4" /></button>)}
              </div>
            ) : null}
          </div>
          <Tabs.Panel value="write">
            <Input ref={textarea} fieldType="auto-grow" allowManualResize submitOnEnter={false} id={id} required={required} aria-describedby={describedBy} rows={rows} maxLength={maxLength} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} renderTrailingContent={compactCounter ? () => counter : undefined} controlClassName="min-h-40 gap-0 rounded-none border-0 bg-transparent p-0 shadow-none focus-within:ring-0" className="min-h-[calc(10rem_-_2px)] resize-y overflow-y-auto scrollbar-design px-3 py-2 text-body-medium tracking-normal" />
          </Tabs.Panel>
          <Tabs.Panel value="preview" className="scrollbar-design min-h-40 overflow-x-auto break-words p-4 [&_img]:max-w-full">
            {value.trim() ? <Markdown content={value} /> : <p className="text-body-medium font-body text-foreground-muted">{t("projects.editor.previewEmpty")}</p>}
          </Tabs.Panel>
        </Tabs.Root>
      )}
      {!compactCounter ? <p id={`${id}-limit`} className="mt-1 text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: value.length, limit: maxLength })}</p> : null}
    </div>
  </div>;
}
