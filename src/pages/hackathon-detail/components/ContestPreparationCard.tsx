import { Copy } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import backgroundPrompt from "@/assets/BackgroundPrompt.svg";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Contest } from "@/types/hackathons";

export function ContestPreparationCard({ contest }: { contest: Pick<Contest, "title" | "slug"> }) {
  const { t } = useTranslation("contests");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/hackathons/${encodeURIComponent(contest.slug ?? "")}`;
  const prompt = t("public.prepare.prompt", { title: contest.title, url });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(t("public.prepare.copied"));
    } catch {
      toast.error(t("public.prepare.copyFailed"));
    }
  };

  return (
    <section data-hackathon-card data-hackathon-prompt-card className="relative min-w-0 overflow-hidden rounded-2xl border-2 border-transparent bg-surface-base p-5 xl:px-4 xl:pt-3 xl:pb-4">
      <img src={backgroundPrompt} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full rounded-2xl object-cover object-center" />
      <div className="relative z-10 flex flex-col gap-2.5">
        <div className="flex flex-col gap-2">
          <h2 data-hackathon-card-title className="font-display text-base font-medium leading-6 tracking-[-0.32px] text-foreground">{t("public.prepare.title")}</h2>
          <Separator />
        </div>
        <textarea
          readOnly
          aria-label={t("public.prepare.promptLabel")}
          className="scrollbar-design h-[120px] w-full resize-none overflow-y-auto rounded-lg border border-input-field-border bg-background px-3 py-2 text-sm leading-[1.4] tracking-[0.28px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          value={prompt}
        />
        <Button type="button" variant="cta" hierarchy="secondary" size="small" data-hackathon-control className="h-[34px] w-full rounded-lg bg-background capitalize" onClick={() => void copy()}><Copy className="size-4" weight="duotone" aria-hidden />{t("public.prepare.copy")}</Button>
      </div>
    </section>
  );
}
