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
    </ComponentShowcaseLayout>
  );
}
