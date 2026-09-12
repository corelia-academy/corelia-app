import { ARTIFACT_FIELDS, type ArtifactField } from "./types";

export function normalizeArtifactDraft(value: unknown): Partial<Record<ArtifactField, string>> {
  const artifacts: Partial<Record<ArtifactField, string>> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return artifacts;
  for (const field of ARTIFACT_FIELDS) {
    const item = (value as Record<string, unknown>)[field];
    if (typeof item === "string") artifacts[field] = item;
  }
  return artifacts;
}

export function readArtifactDraft(key: string): Partial<Record<ArtifactField, string>> {
  try {
    return normalizeArtifactDraft(JSON.parse(localStorage.getItem(key) ?? "null"));
  } catch {
    return {};
  }
}
