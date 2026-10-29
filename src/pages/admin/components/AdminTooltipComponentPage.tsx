import { CircleHelp } from "lucide-react";

import {
  TooltipPreview,
  type TooltipArrow,
} from "@/components/ui/tooltip";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const tooltipArrows = [
  "none",
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-right",
  "top-left",
  "left",
  "right",
] as const satisfies readonly TooltipArrow[];

const arrowLabels = {
  none: "No arrow",
  "bottom-center": "Bottom center",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "top-center": "Top center",
  "top-left": "Top left",
  "top-right": "Top right",
  left: "Left",
  right: "Right",
} as const satisfies Record<TooltipArrow, string>;

const tooltipPreviewAnchorClasses: Record<TooltipArrow, string> = {
  none: "items-end",
  "bottom-center": "items-end",
  "bottom-left": "items-end",
  "bottom-right": "items-end",
  "top-center": "items-start",
  "top-left": "items-start",
  "top-right": "items-start",
  left: "items-center",
  right: "items-center",
};

type AdminTooltipComponentPageProps = {
  embedded?: boolean;
};

export default function AdminTooltipComponentPage({
  embedded = false,
}: AdminTooltipComponentPageProps) {
  const title = "Tooltip";
  const description = "Compare all 18 arrow and supporting-text variants from Figma.";
  const sampleTitle = "This is a tooltip";
  const sampleSupportingText = "Tooltips explain the meaning or function of an element without adding permanent text to the page.";

  return (
    <ComponentShowcaseLayout
      title={title}
      description={description}
      embedded={embedded}
    >
      <ShowcaseSection
        title="Without supporting text"
      >
        <div
          className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3"
          data-testid="tooltip-without-supporting-text-variants"
        >
          {tooltipArrows.map((arrow) => (
            <article
              key={`without-supporting-text-${arrow}`}
              className="rounded-md border border-border-subtle bg-surface-base"
            >
              <h3 className="px-3 pt-3 text-label-medium text-foreground">
                {arrowLabels[arrow]}
              </h3>
              <div
                className={`flex min-h-32 justify-center px-2 pb-6 pt-4 ${tooltipPreviewAnchorClasses[arrow]}`}
              >
                <TooltipPreview
                  arrow={arrow}
                  trigger={<CircleHelp aria-hidden="true" className="size-5" />}
                  triggerLabel={sampleTitle}
                >
                  {sampleTitle}
                </TooltipPreview>
              </div>
            </article>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="With supporting text"
      >
        <div
          className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3"
          data-testid="tooltip-with-supporting-text-variants"
        >
          {tooltipArrows.map((arrow) => (
            <article
              key={`with-supporting-text-${arrow}`}
              className="rounded-md border border-border-subtle bg-surface-base"
            >
              <h3 className="px-3 pt-3 text-label-medium text-foreground">
                {arrowLabels[arrow]}
              </h3>
              <div
                className={`flex min-h-48 justify-center px-2 pb-6 pt-4 ${tooltipPreviewAnchorClasses[arrow]}`}
              >
                <TooltipPreview
                  arrow={arrow}
                  trigger={<CircleHelp aria-hidden="true" className="size-5" />}
                  triggerLabel={sampleTitle}
                  supportingText={sampleSupportingText}
                >
                  {sampleTitle}
                </TooltipPreview>
              </div>
            </article>
          ))}
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
