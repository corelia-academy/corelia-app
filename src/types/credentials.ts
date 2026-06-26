/** Client-facing rows for OpenCampus credential issuances (joined template). */

export type CredentialScopeType = "course" | "hackathon" | "activity_milestone";

export type CredentialIssuanceNetwork = "staging" | "mainnet";

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
  course_id: string | null;
  minted_at: string | null;
  oc_credential_id: string | null;
  network: CredentialIssuanceNetwork;
  status: string;
  template: CredentialTemplateSummary | null;
};
