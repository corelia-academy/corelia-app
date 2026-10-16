import {
  InformativeIcon,
  type InformativeIconColor,
  type InformativeIconSize,
  type InformativeIconType,
} from "@/components/ui/informative-icon"

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout"

const colors: InformativeIconColor[] = ["error", "warning", "success", "blue"]
const sizes: InformativeIconSize[] = ["xs", "sm", "md", "lg", "xl"]
const types: InformativeIconType[] = ["circle", "circle-outline"]
const colorLabels: Record<InformativeIconColor, string> = {
  error: "Error",
  warning: "Warning",
  success: "Success",
  blue: "Blue",
}
const typeLabels: Record<InformativeIconType, string> = {
  circle: "Light circle",
  "circle-outline": "Light circle outline",
}
const matrixGridClass =
  "grid min-w-[38rem] grid-cols-[minmax(5rem,1fr)_repeat(5,minmax(3.5rem,1fr))] items-center justify-items-center gap-3"

type AdminInformativeIconComponentPageProps = {
  embedded?: boolean
}

export default function AdminInformativeIconComponentPage({
  embedded = false,
}: AdminInformativeIconComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Informative Icon"
      description="Compare all 40 Figma variants across color, size, and type."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Colors, sizes, and types"
        criterion="The outline type keeps the colored surface and adds a darker ring."
      >
        <div data-testid="informative-icon-matrix" className="overflow-x-auto">
          <div className="space-y-3">
            {types.map((type) => (
              <div key={type} data-testid={`informative-icon-${type}-group`} className="space-y-3">
                <h3 className="text-heading-small text-foreground">
                  {typeLabels[type]}
                </h3>

                <div className={`${matrixGridClass} px-3 text-body-small text-foreground-muted`}>
                  <span className="justify-self-start">Color</span>
                  {sizes.map((size) => (
                    <span key={size} className="text-center">
                      {size.toUpperCase()}
                    </span>
                  ))}
                </div>

                {colors.map((color) => (
                  <div
                    key={`${type}-${color}`}
                    data-testid={`informative-icon-${type}-color-row-${color}`}
                    className={`${matrixGridClass} rounded-md border border-border-subtle bg-surface-base p-3`}
                  >
                    <span className="justify-self-start text-body-small text-foreground-muted">
                      {colorLabels[color]}
                    </span>
                    {sizes.map((size) => (
                      <div key={`${type}-${color}-${size}`} className="flex min-h-14 items-center justify-center">
                        <InformativeIcon
                          aria-label={`${colorLabels[color]} ${typeLabels[type]}, size ${size.toUpperCase()}`}
                          color={color}
                          size={size}
                          type={type}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  )
}
