/** Client-facing rows for OpenCampus credential issuances (joined template). */

export type CredentialScopeType = "course" | "hackathon" | "activity_milestone";

export type CredentialIssuanceNetwork = "staging" | "mainnet";

export type CredentialTemplateSummary = {
  id: string;
  scope_type: CredentialScopeType;
  name: string;
  description: string;
  image_url: string;
  achievement_type: "Badge" | "Award";
};

export type CredentialIssuanceWithTemplate = {
  id: string;
  minted_at: string | null;
  oc_credential_id: string | null;
  network: CredentialIssuanceNetwork;
  status: string;
  template: CredentialTemplateSummary | null;
};
