import { useState } from "react";

import { InputCode } from "@/components/ui/input-code";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

// Sample copy taken from the Figma frames.
const placeholder = "// Write all of your code here";
const filled = `import {\n} from "@/components/ui/accordion"`;

type SampleProps = {
  label: string;
  initial?: string;
  disabled?: boolean;
  errorLines?: number[];
};

function Sample({ label, initial = "", disabled, errorLines }: SampleProps) {
  const [value, setValue] = useState(initial);
  return (
    <div data-testid={`input-code-${label.toLowerCase()}`} className="space-y-2">
      <p className="text-body-small text-foreground-muted">{label}</p>
      <InputCode language="typescript" value={value} onChange={setValue} placeholder={placeholder} disabled={disabled} errorLines={errorLines} ariaLabel={`${label} code`} />
    </div>
  );
}

type AdminInputCodeComponentPageProps = {
  embedded?: boolean;
};

export default function AdminInputCodeComponentPage({
  embedded = false,
}: AdminInputCodeComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Input Code"
      description="Inspect the coding area where a learner types, in each of its five states."
      embedded={embedded}
    >
      <ShowcaseSection title="States" criterion="Default shows the hint, Filled shows the code, Disabled dims it, and Error marks the wrong line from edge to edge. Click Focused to see the focus ring and the current-line band.">
        <div data-testid="input-code-states" className="flex max-w-4xl flex-col gap-6">
          <Sample label="Default" />
          <Sample label="Filled" initial={filled} />
          <Sample label="Focused" initial={filled} />
          <Sample label="Disabled" initial={filled} disabled />
          <Sample label="Error" initial={filled} errorLines={[2]} />
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
