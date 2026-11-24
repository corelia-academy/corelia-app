import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SideDrawer, type SideDrawerSize } from "@/components/ui/side-drawer"

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout"

const sizes: readonly { size: SideDrawerSize; criterion: string }[] = [
  {
    size: "30vw",
    criterion: "480 px wide: header with the close button on the right and a scrolling content slot.",
  },
  {
    size: "50vw",
    criterion: "720 px wide: same structure for denser content.",
  },
]

export default function AdminSideDrawerComponentPage({
  embedded = false,
}: {
  embedded?: boolean
}) {
  const [openSize, setOpenSize] = useState<SideDrawerSize | null>(null)

  return (
    <ComponentShowcaseLayout
      title="Side Drawer"
      description="Right-hand panel in the two Figma widths: 30vw and 50vw."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Sizes"
        criterion="Open each size to review the overlay, divider, header, and content slot."
      >
        <div className="flex flex-wrap items-center gap-3">
          {sizes.map(({ size }) => (
            <Button
              key={size}
              type="button"
              size="small"
              variant="cta"
              hierarchy="secondary"
              data-testid={`side-drawer-trigger-${size}`}
              onClick={() => setOpenSize(size)}
            >
              Open {size}
            </Button>
          ))}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2" data-testid="side-drawer-criteria">
          {sizes.map(({ size, criterion }) => (
            <div
              key={size}
              className="rounded-xl border border-border-subtle bg-surface-base p-4"
            >
              <dt className="text-title-small font-display">{size}</dt>
              <dd className="mt-1 text-body-small text-foreground-muted">{criterion}</dd>
            </div>
          ))}
        </dl>
      </ShowcaseSection>

      {sizes.map(({ size }) => (
        <SideDrawer
          key={size}
          open={openSize === size}
          onOpenChange={(open) => {
            if (!open) setOpenSize(null)
          }}
          size={size}
          title="Tiêu đề"
          description="Mô tả chung."
        >
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 14 }, (_, index) => (
              <li
                key={index}
                className="rounded-xl border border-border-subtle bg-surface-base p-4 text-body-small"
              >
                Content row {index + 1}
              </li>
            ))}
          </ul>
        </SideDrawer>
      ))}
    </ComponentShowcaseLayout>
  )
}
