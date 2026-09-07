import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/markdown/CodeBlock";

const percentages = [25, 50, 75] as const;

export default function ScrollbarPage() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <main className="container-app space-y-6 py-8">
      <h1 className="text-heading-large font-display">{t("scrollbarDemo.title")}</h1>
      <p className="text-body-medium text-foreground-muted">{t("scrollbarDemo.description")}</p>
      <div className="flex gap-2">
        {(["light", "dark"] as const).map(theme => (
          <Button key={theme} type="button" variant="outline" aria-pressed={resolvedTheme === theme} onClick={() => setTheme(theme)}>
            {t(`scrollbarDemo.${theme}`)}
          </Button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {percentages.map(percent => (
          <section key={percent} className="min-w-0 space-y-3">
            {(["vertical", "horizontal"] as const).map(direction => (
              <div key={direction} className="space-y-2">
                <h2 className="text-title-medium">{t(`scrollbarDemo.${direction}`, { percent })}</h2>
                <div
                  role="region"
                  aria-label={t(`scrollbarDemo.${direction}`, { percent })}
                  tabIndex={0}
                  data-scrollbar-example={`${direction}-${percent}`}
                  className="scrollbar-design max-w-full overflow-auto rounded-md bg-surface-raised outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
                  style={{ width: 240, height: direction === "vertical" ? 240 : 80 }}
                >
                  <div
                    className="grid"
                    style={direction === "vertical"
                      ? { height: 240 * 100 / percent, gridTemplateRows: "repeat(12, 1fr)" }
                      : { width: `${10000 / percent}%`, height: "100%", gridTemplateColumns: "repeat(12, 1fr)" }}
                  >
                    {Array.from({ length: 12 }, (_, index) => (
                      <span key={index} className="flex min-w-0 items-center justify-center overflow-hidden border border-border-subtle text-body-small">
                        {t("scrollbarDemo.sample", { count: index + 1 })}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="min-w-0 space-y-2">
        <h2 className="text-title-medium">{t("scrollbarDemo.code")}</h2>
        <CodeBlock language="javascript" code={`const samples = [${Array.from({ length: 40 }, (_, index) => index + 1).join(", ")}];`} />
      </section>
    </main>
  );
}
