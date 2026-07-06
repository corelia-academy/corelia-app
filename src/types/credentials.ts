/** Client-facing rows for OpenCampus credential issuances (joined template). */

export type CredentialScopeType = "course" | "hackathon" | "activity_milestone";

export type CredentialIssuanceNetwork = "staging" | "mainnet";

export type CredentialDisplaySnapshot = {
  template_id?: string | null;
  credential_title?: string | null;
  credential_description?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  scope_type?: CredentialScopeType | null;
  achievement_type?: CredentialTemplateSummary["achievement_type"] | null;
  course_title?: string | null;
  instructor_name?: string | null;
  hackathon_title?: string | null;
  hackathon_role?: string | null;
  collection_symbol?: "ocbadge" | null;
  issued_at?: string | null;
  metadata?: Record<string, unknown>;
};

export type CredentialTemplateSummary = {
  id: string;
  scope_type: CredentialScopeType;
  name: string;
  description: string;
  /** Full-resolution art sent to OpenCampus (credentialSubject.image). 1600×1200 or 1200×1600. */
  image_url: string;
  /** Smaller preview for in-app cards and notification bell. 800×600 or 600×800. Fallback to image_url if null. */
  thumbnail_url?: string | null;
  achievement_type: "Badge" | "Award" | "MicroCredential" | "Diploma" | "CertificateOfCompletion";
  /** Role/type label for hackathon badges (e.g. "winner", "participant") */
  hackathon_role?: string | null;
  collection_symbol?: "ocbadge" | null;
};

export type CredentialIssuanceWithTemplate = {
  id: string;
  template_id: string | null;
  course_id: string | null;
  hackathon_id: string | null;
  created_at: string | null;
  minted_at: string | null;
  oc_credential_id: string | null;
  oc_response?: unknown;
  network: CredentialIssuanceNetwork;
  status: string;
  display_snapshot: CredentialDisplaySnapshot | null;
  template: CredentialTemplateSummary | null;
};
