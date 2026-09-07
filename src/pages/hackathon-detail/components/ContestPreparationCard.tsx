import { Copy, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    <section className="min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-foreground"><Sparkles className="size-4 shrink-0 text-primary" aria-hidden />{t("public.prepare.title")}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground-muted">{t("public.prepare.description")}</p>
      <textarea
        readOnly
        aria-label={t("public.prepare.promptLabel")}
        className="mt-4 min-h-52 w-full resize-y rounded-lg border border-border-subtle bg-background p-3 text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        value={prompt}
      />
      <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => void copy()}><Copy className="size-4" aria-hidden />{t("public.prepare.copy")}</Button>
    </section>
  );
}
