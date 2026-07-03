import type {
  CredentialDisplaySnapshot,
  CredentialScopeType,
  CredentialTemplateSummary,
} from "@/types/credentials";

const SCOPE_TYPES = new Set<CredentialScopeType>([
  "course",
  "hackathon",
  "activity_milestone",
]);

const ACHIEVEMENT_TYPES = new Set<CredentialTemplateSummary["achievement_type"]>([
  "Badge",
  "Award",
  "MicroCredential",
  "Diploma",
  "CertificateOfCompletion",
]);

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeCredentialDisplaySnapshot(
  value: unknown,
): CredentialDisplaySnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const scope = optionalString(raw.scope_type);
  const achievementType = optionalString(raw.achievement_type);
  const collectionSymbol = optionalString(raw.collection_symbol);
  const metadata = raw.metadata;

  const snapshot: CredentialDisplaySnapshot = {
    template_id: optionalString(raw.template_id),
    credential_title: optionalString(raw.credential_title),
    credential_description: optionalString(raw.credential_description),
    image_url: optionalString(raw.image_url),
    thumbnail_url: optionalString(raw.thumbnail_url),
    scope_type: scope && SCOPE_TYPES.has(scope as CredentialScopeType)
      ? scope as CredentialScopeType
      : null,
    achievement_type:
      achievementType && ACHIEVEMENT_TYPES.has(
        achievementType as CredentialTemplateSummary["achievement_type"],
      )
        ? achievementType as CredentialTemplateSummary["achievement_type"]
        : null,
    course_title: optionalString(raw.course_title),
    instructor_name: optionalString(raw.instructor_name),
    hackathon_title: optionalString(raw.hackathon_title),
    hackathon_role: optionalString(raw.hackathon_role),
    collection_symbol: collectionSymbol === "ocbadge" ? "ocbadge" : null,
    issued_at: optionalString(raw.issued_at),
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata as Record<string, unknown>
        : {},
  };

  return snapshot;
}

export function templateSummaryFromSnapshot(
  snapshot: CredentialDisplaySnapshot | null,
  templateId: string | null,
): CredentialTemplateSummary | null {
  if (!snapshot?.scope_type || !snapshot.achievement_type) return null;

  const name =
    snapshot.credential_title ||
    snapshot.course_title ||
    snapshot.hackathon_title ||
    "Credential";

  return {
    id: snapshot.template_id || templateId || "deleted-template",
    scope_type: snapshot.scope_type,
    name,
    description: snapshot.credential_description || "",
    image_url: snapshot.image_url || snapshot.thumbnail_url || "",
    thumbnail_url: snapshot.thumbnail_url,
    achievement_type: snapshot.achievement_type,
    hackathon_role: snapshot.hackathon_role,
    collection_symbol: snapshot.collection_symbol,
  };
}
