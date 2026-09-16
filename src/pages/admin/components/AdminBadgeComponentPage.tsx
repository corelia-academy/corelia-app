import { Cube } from "@phosphor-icons/react";

import { Badge, type BadgeColor, type BadgeSize, type BadgeVariant } from "@/components/ui/badge";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const colors: BadgeColor[] = ["disabled", "gray", "primary", "error", "warning", "success", "cyan", "gold", "limeGreen"];
const sizes: BadgeSize[] = ["xsmall", "small", "medium", "large"];
const variants: BadgeVariant[] = ["outline", "filled"];
const colorLabels: Record<BadgeColor, string> = {
  primary: "Primary",
  warning: "Warning",
  success: "Success",
  gold: "Gold",
  limeGreen: "Lime green",
  cyan: "Cyan",
  error: "Error",
  gray: "Gray",
  disabled: "Disabled",
};
const sizeLabels: Record<BadgeSize, string> = {
  xsmall: "XSmall",
  small: "Small",
  medium: "Medium",
  large: "Large",
};
const variantLabels: Record<BadgeVariant, string> = {
  outline: "Outline",
  filled: "Filled",
};
const matrixGridClass = "grid min-w-full grid-cols-5 items-center justify-items-center gap-3";

type AdminBadgeComponentPageProps = {
  embedded?: boolean;
};

export default function AdminBadgeComponentPage({
  embedded = false,
}: AdminBadgeComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Badge"
      description="Inspect every Badge color, size, variant, and icon combination."
      embedded={embedded}
    >
      <ShowcaseSection title="Colors and variants" criterion="Every color must remain readable in outline and filled variants.">
        <div data-testid="badge-matrix" className="overflow-x-auto">
          <div className="space-y-3">
            {variants.map((variant) => (
              <div key={variant} data-testid={`badge-${variant}-group`} className="space-y-3">
                <h3 className="text-heading-small text-foreground">{variantLabels[variant]}</h3>

                <div className={`${matrixGridClass} px-3 text-body-small text-foreground-muted`}>
                  <span className="justify-self-start">Color</span>
                  {sizes.map((size) => (
                    <span key={size} className="text-center">{sizeLabels[size]}</span>
                  ))}
                </div>

                {colors.map((color) => (
                  <div
                    key={`${variant}-${color}`}
                    data-testid={`badge-${variant}-color-row-${color}`}
                    className={`${matrixGridClass} rounded-md border border-border-subtle bg-surface-base p-3`}
                  >
                    <span className="justify-self-start text-body-small text-foreground-muted">{colorLabels[color]}</span>
                    {sizes.map((size) => {
                      if (size === "xsmall") {
                        return (
                          <Badge key={`${variant}-${color}-${size}`} color={color} size={size} variant={variant}>
                            Label
                          </Badge>
                        );
                      }

                      return (
                        <Badge
                          key={`${variant}-${color}-${size}`}
                          color={color}
                          size={size}
                          variant={variant}
                          leadingIcon={<Cube className="size-4" weight="regular" />}
                          trailingIcon={<Cube className="size-4" weight="regular" />}
                        >
                          Label
                        </Badge>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
