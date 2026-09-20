import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const percentages = [25, 50, 75] as const;

type AdminScrollbarComponentPageProps = {
  embedded?: boolean;
};

export default function AdminScrollbarComponentPage({
  embedded = false,
}: AdminScrollbarComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Scrollbar"
      description="Inspect real overflow across vertical, horizontal, and content-density examples."
      embedded={embedded}
    >
      <ShowcaseSection title="Scrollable examples" criterion="Scrollbars must be usable in both directions and themes.">
        <div className="grid gap-6 md:grid-cols-3">
          {percentages.map((percent) => (
            <div key={percent} className="space-y-4">
              <h2 className="text-title-medium text-foreground">{percent}% content density</h2>
              <ScrollbarExample direction="vertical" percent={percent} />
              <ScrollbarExample direction="horizontal" percent={percent} />
            </div>
          ))}
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}

function ScrollbarExample({ direction, percent }: { direction: "vertical" | "horizontal"; percent: number }) {
  const isVertical = direction === "vertical";

  return (
    <div role="region" aria-label={`${isVertical ? "Vertical" : "Horizontal"} scrollbar at ${percent}%`} tabIndex={0} className="scrollbar-design max-w-full overflow-auto rounded-md bg-surface-raised outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary" style={{ width: 240, height: isVertical ? 240 : 80 }}>
      <div className="grid" style={isVertical ? { height: (240 * 100) / percent, gridTemplateRows: "repeat(12, 1fr)" } : { width: `${10000 / percent}%`, height: "100%", gridTemplateColumns: "repeat(12, 1fr)" }}>
        {Array.from({ length: 12 }, (_, index) => <span key={index} className="flex min-w-0 items-center justify-center overflow-hidden border border-border-subtle text-body-small">Sample {index + 1}</span>)}
      </div>
    </div>
  );
}
