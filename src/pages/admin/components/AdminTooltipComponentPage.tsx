import { useTranslation } from "react-i18next";
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

const arrowLabelKeys = {
  none: "componentShowcase.tooltip.arrows.none",
  "bottom-center": "componentShowcase.tooltip.arrows.bottomCenter",
  "bottom-left": "componentShowcase.tooltip.arrows.bottomLeft",
  "bottom-right": "componentShowcase.tooltip.arrows.bottomRight",
  "top-center": "componentShowcase.tooltip.arrows.topCenter",
  "top-left": "componentShowcase.tooltip.arrows.topLeft",
  "top-right": "componentShowcase.tooltip.arrows.topRight",
  left: "componentShowcase.tooltip.arrows.left",
  right: "componentShowcase.tooltip.arrows.right",
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
  const { t } = useTranslation("common");
  const title = t("componentShowcase.tooltip.title");
  const description = t("componentShowcase.tooltip.description");
  const sampleTitle = t("componentShowcase.tooltip.sampleTitle");
  const sampleSupportingText = t(
    "componentShowcase.tooltip.sampleSupportingText",
  );

  return (
    <ComponentShowcaseLayout
      title={title}
      description={description}
      embedded={embedded}
    >
      <ShowcaseSection
        title={t("componentShowcase.tooltip.withoutSupportingText")}
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
                {t(arrowLabelKeys[arrow])}
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
        title={t("componentShowcase.tooltip.withSupportingText")}
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
                {t(arrowLabelKeys[arrow])}
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
