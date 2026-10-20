import { useId, useState } from "react";
import { CheckCircle, GithubLogo, XCircle } from "@phosphor-icons/react";
import { FileSliders, Globe, Mic, Plus, Video, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ProjectDraft } from "./projectEditorDraft";

const resources = [
  { key: "demo", icon: Globe, example: "https://my-project.example.com" },
  { key: "slide", icon: FileSliders, example: "https://docs.google.com/presentation/d/…" },
  { key: "repo", icon: GithubLogo, example: "https://github.com/your-team/your-project" },
  { key: "video", icon: Video, example: "https://www.youtube.com/watch?v=…" },
  { key: "pitchVideo", icon: Mic, example: "https://www.loom.com/share/…" },
] as const;
type ResourceKey = typeof resources[number]["key"];

export function ProjectResourcesEditor({ draft, onChange, presentation = "default" }: {
  draft: Pick<ProjectDraft, ResourceKey>;
  onChange: (key: ResourceKey, value: string) => void;
  presentation?: "default" | "submission";
}) {
  const { t } = useTranslation("common");
  const id = useId();
  const [expanded, setExpanded] = useState<ResourceKey[]>(() => resources.filter(({ key }) => draft[key]).map(({ key }) => key));
  const [focusKey, setFocusKey] = useState<ResourceKey | null>(null);
  const [touched, setTouched] = useState<ResourceKey[]>([]);

  if (presentation === "submission") {
    const submissionResourceKeys = ["repo", "demo", "slide", "video"] as const;
    const visibleResources = submissionResourceKeys
      .map((key) => resources.find((resource) => resource.key === key))
      .filter((resource): resource is (typeof resources)[number] => Boolean(resource));

    return <section id="project-links" className="scroll-mt-24">
      <Separator className="mb-6" />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-x-12">
        <div>
          <h2 className="text-heading-medium font-display text-project-editor-heading">{t("projects.editor.submissionLinksTitle")}</h2>
          <p className="mt-4 text-body-small font-body text-foreground-subtle">{t("projects.editor.submissionLinksHint")}</p>
        </div>
        <div className="min-w-0 space-y-3">
          {visibleResources.map(({ key, icon: Icon }) => {
            const inputId = `${id}-${key}`;
            const value = draft[key].trim();
            const valid = Boolean(value) && isSafeSubmissionResource(key, value);
            const invalid = touched.includes(key) && Boolean(value) && !valid;
            const statusIcon = valid
              ? <CheckCircle className="size-5 text-success" weight="duotone" aria-hidden />
              : invalid
                ? <XCircle className="size-5 text-destructive" weight="duotone" aria-hidden />
                : null;
            return <div key={key} className="min-w-0">
              <Input
                id={inputId}
                type="url"
                variant="icon-leading"
                leadingIcon={key === "repo" ? <GithubLogo className="size-5 text-foreground-subtle" weight="duotone" aria-hidden /> : <Icon className="size-5 text-foreground-subtle" aria-hidden />}
                statusIcon={statusIcon}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                maxLength={2048}
                pattern="https://.*"
                placeholder={t(`projects.editor.resourceFields.${key}.placeholder`)}
                aria-label={t(`projects.editor.resourceFields.${key}.label`)}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${inputId}-error` : undefined}
                controlClassName="h-10 rounded-lg border-border bg-background px-3"
                className="text-body-medium placeholder:text-foreground-subtle"
                value={draft[key]}
                onChange={(event) => onChange(key, event.currentTarget.value)}
                onBlur={() => setTouched((current) => [...new Set([...current, key])])}
              />
              {valid ? <p className="sr-only" role="status">{t("projects.editor.resourceUrlValid")}</p> : null}
              {invalid ? <p id={`${inputId}-error`} className="mt-2 text-body-small text-destructive" role="alert">{t(key === "repo" ? "projects.form.errors.invalidRepoUrl" : "projects.form.errors.invalidUrl")}</p> : null}
            </div>;
          })}
        </div>
      </div>
    </section>;
  }

  return <section id="project-links" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-heading-medium font-display">{t("projects.editor.links")}</h2>
      <span className="rounded-full bg-surface-raised px-3 py-1 text-label-small text-foreground-muted">{t("projects.editor.optional")}</span>
    </div>
    <p className="mt-2 text-body-medium text-foreground-muted">{t("projects.editor.linksHint")}</p>
    <p className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-body-medium">{t("projects.editor.ideaHint")}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {resources.map(({ key, icon: Icon, example }) => {
        const visible = expanded.includes(key) || Boolean(draft[key]);
        const inputId = `${id}-${key}`;
        const invalid = touched.includes(key) && Boolean(draft[key].trim()) && !isHttpsResource(draft[key]);
        return <div key={key} className="min-w-0 rounded-xl border border-border bg-background">
          {visible ? <div className="p-4">
            <div className="flex items-center gap-2">
              {key === "repo" ? <GithubLogo className="size-4 shrink-0 text-primary" weight="duotone" aria-hidden /> : <Icon className="size-4 shrink-0 text-primary" aria-hidden />}
              <label htmlFor={inputId} className="flex-1 text-label-medium">{t(`projects.editor.resourceFields.${key}.label`)}</label>
              <Button type="button" variant="cta" hierarchy="tertiary" iconOnly size="small" aria-label={t("projects.editor.removeResource", { resource: t(`projects.editor.resourceFields.${key}.label`) })} onClick={() => {
                onChange(key, "");
                setExpanded(current => current.filter(item => item !== key));
                setTouched(current => current.filter(item => item !== key));
              }}><X className="size-4" aria-hidden /></Button>
            </div>
            <p id={`${inputId}-hint`} className="mt-2 text-body-small text-foreground-muted">{t(`projects.editor.resourceFields.${key}.hint`)}</p>
            <Input autoFocus={focusKey === key} id={inputId} className="mt-3" type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} pattern="https://.*" placeholder={example} value={draft[key]} aria-describedby={`${inputId}-hint${invalid ? ` ${inputId}-error` : ""}`} aria-invalid={invalid || undefined} onChange={event => { setExpanded(current => [...new Set([...current, key])]); onChange(key, event.target.value); }} onBlur={() => setTouched(current => [...new Set([...current, key])])} />
            {invalid ? <p id={`${inputId}-error`} className="mt-2 text-body-small text-destructive" role="alert">{t("projects.editor.httpsHint")}</p> : null}
          </div> : <button type="button" aria-label={t("projects.editor.addResource", { resource: t(`projects.editor.resourceFields.${key}.label`) })} className="flex min-h-24 w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary" aria-expanded={false} onClick={() => { setFocusKey(key); setExpanded(current => [...current, key]); }}>
            {key === "repo" ? <GithubLogo className="mt-0.5 size-5 shrink-0 text-primary" weight="duotone" aria-hidden /> : <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />}
            <span className="min-w-0 flex-1 break-words"><span className="block text-label-medium">{t("projects.editor.addResource", { resource: t(`projects.editor.resourceFields.${key}.label`) })}</span><span className="mt-2 block text-body-small text-foreground-muted">{t(`projects.editor.resourceFields.${key}.hint`)}</span></span>
            <Plus className="size-4 shrink-0 text-foreground-muted" aria-hidden />
          </button>}
        </div>;
      })}
    </div>
    <p className="mt-4 text-body-small text-foreground-muted">{t("projects.editor.resourceAccessHint")}</p>
  </section>;
}

function isHttpsResource(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch { return false; }
}

// Mirror the server checks for immediate feedback; the server remains authoritative when saving.
function isSafeSubmissionResource(key: ResourceKey, value: string) {
  if (!value || value.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password || isUnsafeResourceHostname(url.hostname)) {
    return false;
  }

  if (key !== "repo") return true;

  const pathParts = url.pathname.split("/").filter(Boolean);
  return url.hostname.toLowerCase() === "github.com" && pathParts.length === 2;
}

function isUnsafeResourceHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const ipv4Parts = host.split(".").map(Number);
  const isIpv4 = ipv4Parts.length === 4
    && ipv4Parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
  const isPrivateIpv4 = isIpv4 && (
    ipv4Parts[0] === 10
    || ipv4Parts[0] === 127
    || (ipv4Parts[0] === 169 && ipv4Parts[1] === 254)
    || (ipv4Parts[0] === 172 && ipv4Parts[1] >= 16 && ipv4Parts[1] <= 31)
    || (ipv4Parts[0] === 192 && ipv4Parts[1] === 168)
    || ipv4Parts[0] === 0
  );
  const firstIpv6Hextet = host.includes(":")
    ? Number.parseInt(host.split(":", 1)[0] || "0", 16)
    : Number.NaN;
  const isUnsafeIpv6 = host.includes(":") && (
    host === "::"
    || host === "::1"
    || host.includes(".")
    || (Number.isInteger(firstIpv6Hextet) && (firstIpv6Hextet & 0xfe00) === 0xfc00)
    || (Number.isInteger(firstIpv6Hextet) && (firstIpv6Hextet & 0xffc0) === 0xfe80)
  );

  return host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || isUnsafeIpv6
    || Boolean(isPrivateIpv4);
}
