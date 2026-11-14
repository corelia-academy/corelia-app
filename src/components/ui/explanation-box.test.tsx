import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ExplanationBox } from "./explanation-box"

describe("ExplanationBox", () => {
  it("renders the correct state with a success title and a done status icon", () => {
    const markup = renderToStaticMarkup(
      <ExplanationBox status="correct" title="Correct" statusLabel="Correct answer">
        Because blockchains are append-only.
      </ExplanationBox>,
    )

    expect(markup).toContain('data-status="correct"')
    expect(markup).toContain("Correct")
    expect(markup).toContain("Because blockchains are append-only.")
    expect(markup).toContain("text-success")
    expect(markup).toContain('data-state="done"')
    expect(markup).toContain('aria-label="Correct answer"')
    expect(markup).toContain("bg-explanation-box-surface")
  })

  it("renders the incorrect state with a destructive title and a failed status icon", () => {
    const markup = renderToStaticMarkup(
      <ExplanationBox status="incorrect" title="Think about it" statusLabel="Wrong answer">
        Read the explanation again.
      </ExplanationBox>,
    )

    expect(markup).toContain('data-status="incorrect"')
    expect(markup).toContain("text-destructive")
    expect(markup).not.toContain("text-success")
    expect(markup).toContain('data-state="failed"')
  })

  it("omits the body when there is no explanation text", () => {
    const markup = renderToStaticMarkup(
      <ExplanationBox status="correct" title="Correct" statusLabel="Correct answer" />,
    )

    expect(markup).not.toContain("text-action-text")
  })

  it("merges a caller className after the defaults", () => {
    const markup = renderToStaticMarkup(
      <ExplanationBox className="rounded-lg" status="correct" title="Correct" statusLabel="Correct answer" />,
    )

    expect(markup).toContain("rounded-lg")
  })
})
