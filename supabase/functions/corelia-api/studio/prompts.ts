export type PromptKey =
  | "a1-catalog-research"
  | "a2-brief"
  | "a2-research"
  | "a3-curriculum"
  | "a4-curriculum-review"
  | "a5-lesson"
  | "a6-lesson-review"
  | "a7-translate"
  | "a8-video-segment";

export type AgentRole = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";

/** Runtime pins each agent to an immutable database prompt version. */
export const PROMPT_VERSIONS: Record<PromptKey, number> = {
  "a1-catalog-research": 7,
  "a2-brief": 12,
  "a2-research": 16,
  "a3-curriculum": 27,
  "a4-curriculum-review": 24,
  "a5-lesson": 31,
  "a6-lesson-review": 29,
  "a7-translate": 3,
  "a8-video-segment": 1,
};

export function promptVersion(key: PromptKey, version: number): string {
  return `${key}@v${version}`;
}
