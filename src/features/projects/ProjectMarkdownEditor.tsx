import { Tabs } from "@base-ui/react/tabs";
import { Bold, Code, Heading2, Italic, Link, List } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/markdown/Markdown";

export function ProjectMarkdownEditor({ label, value, onChange, maxLength, required, placeholder, hint, rows = 10 }: {
  label: string; value: string; onChange: (value: string) => void; maxLength: number;
  required: boolean; placeholder: string; hint?: string; rows?: number;
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
  return <div className="min-w-0">
    <label htmlFor={id} className="text-label-medium font-body">{label}{required ? <span className="text-primary"> *</span> : null}</label>
    {hint ? <p id={`${id}-hint`} className="mt-2 text-body-small text-foreground-muted">{hint}</p> : null}
    <Tabs.Root value={mode} onValueChange={value => setMode(String(value))} className="mt-2 overflow-hidden rounded-lg border border-border bg-background">
      <Tabs.List aria-label={`${label} — Markdown`} className="flex gap-1 border-b border-border p-2">
        {(["write", "preview"] as const).map(tab => <Tabs.Tab key={tab} value={tab} className="min-h-10 rounded-md px-3 text-cta-medium font-body data-[active]:bg-primary/10 data-[active]:text-primary">{t(`projects.editor.${tab}`)}</Tabs.Tab>)}
      </Tabs.List>
      <Tabs.Panel value="write">
        <div role="group" aria-label={t("projects.editor.formatting")} className="flex flex-wrap gap-1 border-b border-border p-2">
          {actions.map(action => <button key={action.key} type="button" onClick={() => format(action)} title={t(`projects.editor.markdown${action.key}`)} aria-label={t(`projects.editor.markdown${action.key}`)} className="flex size-10 items-center justify-center rounded-md hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"><action.icon className="size-4" /></button>)}
        </div>
        <textarea ref={textarea} id={id} required={required} aria-describedby={`${id}-limit${hint ? ` ${id}-hint` : ""}`} rows={rows} maxLength={maxLength} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="block w-full resize-y bg-transparent px-3 py-2 text-body-medium font-body focus-visible:outline-2 focus-visible:outline-primary" />
      </Tabs.Panel>
      <Tabs.Panel value="preview" className="scrollbar-design min-h-40 overflow-x-auto break-words p-4 [&_img]:max-w-full">
        {value.trim() ? <Markdown content={value} /> : <p className="text-body-medium font-body text-foreground-muted">{t("projects.editor.previewEmpty")}</p>}
      </Tabs.Panel>
    </Tabs.Root>
    <p id={`${id}-limit`} className="mt-1 text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: value.length, limit: maxLength })}</p>
  </div>;
}
