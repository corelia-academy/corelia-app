import { CodeBlock, type CodeBlockTab } from "@/components/ui/code-block";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

// Sample copy taken from the Figma frames.
const gitSample = `git init
git add .
git commit -m "init hello solana setup"
git branch -M main
git remote add origin <repo-url>
git push -u origin main`;

const tabs: CodeBlockTab[] = [
  { id: "threejs", label: "threejs", language: "javascript", code: "import * as THREE from \"three\";\nconst scene = new THREE.Scene();" },
  { id: "javascript", label: "javascript", language: "javascript", code: "const sum = (a, b) => a + b;\nconsole.log(sum(1, 2));" },
  { id: "typescript", label: "typescript", language: "typescript", code: "const sum = (a: number, b: number) => a + b;\nconsole.log(sum(1, 2));" },
];

const solidity = `contract Counter {
  uint256 public count;

  function increment() public {
    count += 1;
  }
}`;

type AdminCodeBlockComponentPageProps = {
  embedded?: boolean;
};

export default function AdminCodeBlockComponentPage({
  embedded = false,
}: AdminCodeBlockComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Code Block"
      description="Inspect the read-only code block: no header, one language label, and language tabs."
      embedded={embedded}
    >
      <ShowcaseSection title="Header" criterion="No header floats the copy button in the body; one language shows a label; several languages show tabs.">
        <div data-testid="code-block-headers" className="flex max-w-4xl flex-col gap-6">
          <CodeBlock language="bash" code={gitSample} header={false} />
          <CodeBlock language="bash" code={gitSample} />
          <CodeBlock tabs={tabs} />
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Options" criterion="Line numbers and the copy button can be turned off, and long lines scroll sideways.">
        <div data-testid="code-block-options" className="flex max-w-4xl flex-col gap-6">
          <CodeBlock language="bash" code={gitSample} showLineNumbers={false} />
          <CodeBlock language="bash" code={gitSample} copyable={false} />
          <CodeBlock language="javascript" code={`const values = [${"1, ".repeat(60)}];`} />
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Solidity" criterion="Solidity blocks also offer Run in Remix.">
        <div data-testid="code-block-solidity" className="flex max-w-4xl flex-col gap-6">
          <CodeBlock language="solidity" code={solidity} />
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
