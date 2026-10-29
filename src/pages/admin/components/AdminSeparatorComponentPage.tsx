import { Separator } from "@/components/ui/separator";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

type AdminSeparatorComponentPageProps = {
  embedded?: boolean;
};

export default function AdminSeparatorComponentPage({
  embedded = false,
}: AdminSeparatorComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Separator"
      description="Inspect solid and dashed separators in horizontal and vertical orientations."
      embedded={embedded}
    >
      <ShowcaseSection title="Horizontal" criterion="Solid and dashed horizontal separators are visible.">
        <div className="space-y-5"><Separator /><Separator variant="dashed" /></div>
      </ShowcaseSection>
      <ShowcaseSection title="Vertical" criterion="Solid and dashed vertical separators preserve size.">
        <div className="flex h-32 justify-center gap-8"><Separator orientation="vertical" /><Separator orientation="vertical" variant="dashed" /></div>
      </ShowcaseSection>
      <ShowcaseSection
        title="Four-sided frames"
        criterion="Solid frames stay unchanged; dashed frames show two dash densities."
      >
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <p className="text-body-small font-body text-foreground-muted">
              Solid
            </p>
            <div className="size-24">
              <Separator shape="frame" className="rounded-lg border-neutral-500" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-body-small font-body text-foreground-muted">
              Denser dashes
            </p>
            <div className="size-24">
              <Separator
                shape="frame"
                variant="dashed"
                dashPattern={{ dashLength: 4, gapLength: 3 }}
                className="rounded-lg border-neutral-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-body-small font-body text-foreground-muted">
              Sparser dashes
            </p>
            <div className="size-24">
              <Separator
                shape="frame"
                variant="dashed"
                dashPattern={{ dashLength: 8, gapLength: 6 }}
                className="rounded-lg border-neutral-500"
              />
            </div>
          </div>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
