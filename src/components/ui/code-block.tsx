import { useState, type ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { ArrowSquareOut, Copy as PhCopy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsGroup } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SOLIDITY_LANGS, codeLanguageLabel, codeSyntaxStyle } from "./code-syntax";

const FRAME_CLASS = "relative overflow-hidden rounded-xl bg-code-block-surface font-mono";

// Hover and press tints come from the text colour, so they stay visible on the header and body in both themes.
const ACTION_CLASS = "hover:bg-foreground/10 active:bg-foreground/15";

export type CodeBlockTab = { id: string; label: string; language: string; code: string };

export type CodeBlockProps = {
  /** Single block: the language id (for example "rust") and its source. Ignored when `tabs` is given. */
  language?: string;
  code?: string;
  /** Several languages of one snippet. Shows the tab header. */
  tabs?: CodeBlockTab[];
  /** Single block only: true shows the language label header (default), false floats the actions in the body. */
  header?: boolean;
  showLineNumbers?: boolean;
  copyable?: boolean;
  className?: string;
};

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation("common");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("actions.copied"), { position: "top-right" });
    } catch {
      toast.error(t("actions.copyFailed"), { position: "top-right" });
    }
  }

  return (
    <Button type="button" variant="cta" hierarchy="tertiary" iconOnly size="small" className={ACTION_CLASS}
      onClick={() => void handleCopy()} title={t("actions.copy")} aria-label={t("actions.copy")}>
      <PhCopy weight="duotone" className="size-5" aria-hidden />
    </Button>
  );
}

/** Kept from the previous CodeBlock. Opens the snippet in the Remix IDE; the label collapses to the icon on narrow screens. */
function RemixButton({ code }: { code: string }) {
  const { t } = useTranslation("common");
  const url = `https://remix.ethereum.org/#code=${btoa(unescape(encodeURIComponent(code)))}`;

  return (
    <Button type="button" variant="cta" hierarchy="tertiary" size="small" className={ACTION_CLASS}
      render={<a href={url} target="_blank" rel="noreferrer" />} nativeButton={false}>
      <ArrowSquareOut weight="duotone" aria-hidden />
      <span className="max-sm:sr-only">{t("actions.runInRemix")}</span>
    </Button>
  );
}

export function CodeBlock({ language = "", code = "", tabs, header = true, showLineNumbers = true, copyable = true, className }: CodeBlockProps) {
  const hasTabs = !!tabs?.length;
  const items: CodeBlockTab[] = hasTabs ? tabs : [{ id: "single", label: codeLanguageLabel(language), language, code }];
  const [activeId, setActiveId] = useState(items[0].id);
  const active = items.find(item => item.id === activeId) ?? items[0];
  const digits = String(active.code.split("\n").length).length;

  const actions: ReactNode = (
    <>
      {SOLIDITY_LANGS.has(active.language) && <RemixButton code={active.code} />}
      {copyable && <CopyButton text={active.code} />}
    </>
  );

  // Figma geometry: 16px text on a 32px line, 20px side padding, 20px between the numbers and the code.
  // Figma's line box is 16px and ours 32px, so the vertical padding is 12px to put the text on the same spot.
  const body = (
    <SyntaxHighlighter className="scrollbar-design" tabIndex={0} language={active.language || "text"}
      showLineNumbers={showLineNumbers}
      lineNumberStyle={{ display: "inline-block", minWidth: `${digits}ch`, paddingRight: "1.25rem", textAlign: "right", userSelect: "none", color: "var(--code-block-line-number)" }}
      style={codeSyntaxStyle}
      customStyle={{ margin: 0, borderRadius: 0, background: "transparent", fontSize: "1rem", lineHeight: "2rem", letterSpacing: "-0.01em", padding: "0.75rem 1.25rem" }}
      codeTagProps={{ style: { fontFamily: "inherit" } }} wrapLongLines={false}>
      {active.code}
    </SyntaxHighlighter>
  );

  if (!hasTabs) {
    return <CodeBlockFrame label={active.label} header={header} actions={actions} className={className}>{body}</CodeBlockFrame>;
  }

  return (
    <div data-slot="code-block" data-header="tabs" className={cn(FRAME_CLASS, className)}>
      <Tabs.Root value={active.id} onValueChange={value => setActiveId(String(value))}>
        <div className="flex items-center justify-between gap-md bg-code-block-header-surface pl-lg pr-xs pt-xxs font-body">
          <TabsGroup level="2a" className="min-w-0 max-w-full overflow-x-auto border-tabs-border-divider">
            <Tabs.List level="2a" className="gap-3xl">
              {items.map(item => <Tabs.Tab key={item.id} value={item.id}>{item.label}</Tabs.Tab>)}
            </Tabs.List>
          </TabsGroup>
          <div className="flex shrink-0 items-center gap-xs">{actions}</div>
        </div>
        <Tabs.Panel value={active.id}>{body}</Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}

/** The frame of a code block: language label header (or none, with the actions floating in the body) and the body. */
export function CodeBlockFrame({ label, header = true, actions, className, children }: { label: string; header?: boolean; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div data-slot="code-block" data-header={header ? "label" : "none"} className={cn(FRAME_CLASS, className)}>
      {header ? (
        <div className="relative bg-code-block-header-surface p-lg font-body">
          <p className="text-body-medium font-medium text-foreground">{label}</p>
          <div className="absolute right-xs top-1/2 flex -translate-y-1/2 items-center gap-xs">{actions}</div>
        </div>
      ) : (
        <div className="absolute right-xs top-xs z-10 flex items-center gap-xs font-body">{actions}</div>
      )}
      {children}
    </div>
  );
}

/** One row of a hand-built code body, such as a fill-in-the-blank line: number gutter plus content. */
export function CodeBlockLine({ number, digits, children }: { number: number; digits: number; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center">
      <span aria-hidden="true" className="shrink-0 select-none pr-2xl text-right text-code-block-line-number" style={{ minWidth: `calc(${digits}ch + 1.25rem)` }}>{number}</span>
      <code className="flex items-center gap-2md whitespace-pre text-code-block-text">{children}</code>
    </div>
  );
}

/** Inline highlighted code that inherits the font and size of its parent. */
export function CodeSpan({ code, language }: { code: string; language: string }) {
  return (
    <SyntaxHighlighter PreTag="span" CodeTag="span" language={language || "text"} style={codeSyntaxStyle}
      customStyle={{ margin: 0, padding: 0, background: "transparent", fontSize: "inherit", lineHeight: "inherit", overflow: "visible", display: "inline" }}
      codeTagProps={{ style: { fontFamily: "inherit", whiteSpace: "pre" } }}>
      {code}
    </SyntaxHighlighter>
  );
}
