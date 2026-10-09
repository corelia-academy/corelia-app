import { UserCircle } from "@phosphor-icons/react";

import { Chip, type ChipShape, type ChipSize } from "@/components/ui/chip";
import { Tag, type TagSize } from "@/components/ui/tag";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const sizes: TagSize[] = ["small", "medium", "large"];
const chipSizes: ChipSize[] = ["xsmall", "small", "medium", "large"];
const chipShapes: ChipShape[] = ["rounded", "circle"];
const chipSizeLabels: Record<ChipSize, string> = {
  xsmall: "Xsmall",
  small: "Small",
  medium: "Medium",
  large: "Large",
};
const sizeLabels: Record<TagSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

type AdminTagComponentPageProps = {
  embedded?: boolean;
};

export default function AdminTagComponentPage({
  embedded = false,
}: AdminTagComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Tag / Chips"
      description="Inspect label and date-time tags across sizes, visual slots, disabled state, and themes."
      embedded={embedded}
    >
      <ShowcaseSection title="Label tags" criterion="Label, size, leading visual, and disabled states must be visible.">
        <div className="grid gap-3 overflow-x-auto">
          {sizes.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle p-3">
              <span className="w-full text-body-small text-foreground-muted sm:w-auto">{sizeLabels[size]}</span>
              <Tag type="label" size={size} className="pointer-events-none">Enabled</Tag>
              <Tag type="label" size={size} className="pointer-events-none" leadingVisual={<UserCircle className="size-4" />}>Avatar visual</Tag>
              <Tag type="label" size={size} disabled>Disabled</Tag>
              <Tag type="label" size={size} disabled leadingVisual={<UserCircle className="size-4" />}>Disabled</Tag>
            </div>
          ))}
        </div>
      </ShowcaseSection>
      <ShowcaseSection
        title="Chips"
        criterion="Four sizes, two shapes, and active/disabled states must be visible."
      >
        <div className="grid gap-3 overflow-x-auto">
          {chipSizes.map((size) => (
            <div
              key={size}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle p-3"
            >
              <span className="w-full text-body-small text-foreground-muted sm:w-16">
                {chipSizeLabels[size]}
              </span>

              {chipShapes.map((shape) => (
                <div key={shape} className="flex items-center gap-2">
                  <Chip size={size} shape={shape} className="pointer-events-none">
                    +2
                  </Chip>
                  <Chip size={size} shape={shape} disabled>
                    +2
                  </Chip>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Date-time tags" criterion="Date, time, and date-time combinations must preserve separator contrast.">
        <div className="grid gap-3 overflow-x-auto">
          {sizes.flatMap((size) => [false, true].map((disabled) => (
            <div key={`${size}-${disabled}`} className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle p-3">
              <span className="w-full text-body-small text-foreground-muted sm:w-16">{sizeLabels[size]}</span>
              <Tag type="datetime" size={size} date="14 Sep 2026" disabled={disabled} className={disabled ? undefined : "pointer-events-none"} />
              <Tag type="datetime" size={size} time="10:30" disabled={disabled} className={disabled ? undefined : "pointer-events-none"} />
              <Tag type="datetime" size={size} date="14 Sep 2026" time="10:30" disabled={disabled} className={disabled ? undefined : "pointer-events-none"} />
            </div>
          ))) }
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
