import type { ArtifactField } from "./types";
import { normalizeArtifactDraft } from "./artifactDraft";

export interface PracticeDraft {
  checked: Record<string, boolean>;
  artifacts: Partial<Record<ArtifactField, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Browser storage is untrusted: retain valid entries without trusting parsed shapes. */
export function readPracticeDraft(key: string | null): PracticeDraft {
  const empty: PracticeDraft = { checked: {}, artifacts: {} };
  if (!key) return empty;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!isRecord(value)) return empty;
    const checked: Record<string, boolean> = isRecord(value.checked)
      ? Object.fromEntries(Object.entries(value.checked).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"))
      : {};
    return { checked, artifacts: normalizeArtifactDraft(value.artifacts) };
  } catch {
    return empty;
  }
}
