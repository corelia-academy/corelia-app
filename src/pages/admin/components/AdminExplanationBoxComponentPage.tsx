import { ExplanationBox } from "@/components/ui/explanation-box";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

// Sample copy taken from the Figma frame.
const body =
  "At the heart of Web3 lies blockchain technology, a decentralized ledger that ensures transparency and security in digital transactions. Unlike traditional databases, blockchain operates on a network of computers, making data tampering virtually impossible. This innovation paves the way for new internet applications that empower users rather than centralized authorities.";

type AdminExplanationBoxComponentPageProps = {
  embedded?: boolean;
};

export default function AdminExplanationBoxComponentPage({
  embedded = false,
}: AdminExplanationBoxComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Explanation Box"
      description="Inspect the correct and incorrect feedback boxes shown after a quiz answer is checked."
      embedded={embedded}
    >
      <ShowcaseSection title="Status" criterion="Correct uses the success title with a done icon; incorrect uses the destructive title with a failed icon.">
        <div data-testid="explanation-box-status" className="flex max-w-3xl flex-col gap-6">
          <ExplanationBox status="correct" title="Correct" statusLabel="Correct answer">{body}</ExplanationBox>
          <ExplanationBox status="incorrect" title="Think about it" statusLabel="Wrong answer">{body}</ExplanationBox>
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Content" criterion="The body is optional, and long text wraps inside the box.">
        <div data-testid="explanation-box-content" className="flex max-w-3xl flex-col gap-6">
          <ExplanationBox status="correct" title="Correct" statusLabel="Correct answer" />
          <ExplanationBox status="incorrect" title="Think about it" statusLabel="Wrong answer">{body} {body}</ExplanationBox>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
