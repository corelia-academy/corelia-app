import type { MintNetwork } from "./settings.ts";
import { achievementIdentifier, issuerReferenceId } from "./ids.ts";

export type CredentialTemplateRow = {
  id: string;
  scope_type: "course" | "hackathon" | "activity_milestone";
  course_id: string | null;
  hackathon_id: string | null;
  name: string;
  description: string;
  /** Full-resolution art for OC payload (credentialSubject.image). 1600×1200 or 1200×1600 px. */
  image_url: string;
  /** Smaller preview for in-app display (cards, notification bell). 800×600 or 600×800 px. Null = use image_url. */
  thumbnail_url?: string | null;
  /**
   * OCB (collection_symbol='ocbadge') : 'Badge' | 'Award'
   * OCA (collection_symbol=NULL)       : 'MicroCredential' | 'Diploma' | 'CertificateOfCompletion'
   *
   * Courses specifically may be either Badge (OCB) or CertificateOfCompletion (OCA)
   * depending on how the admin configures the template.
   */
  achievement_type: "Badge" | "Award" | "MicroCredential" | "Diploma" | "CertificateOfCompletion";
  identifier_prefix: string;
  /** 'ocbadge' → OCB (sent in payload). NULL → OCA (collectionSymbol omitted, OC defaults to OCA). */
  collection_symbol: string | null;
  custom_metadata: Record<string, unknown>;
  network_override?: string | null;
  /** 'manual' = granted via Admin Manual Mint, unrelated to auto milestone badges
   *  that also use scope_type="activity_milestone". */
  trigger_type?: string | null;
};

/**
 * A credential is OCA when collection_symbol is NULL.
 * OCA payloads include credentialSubject.name + email and omit collectionSymbol.
 * OCB payloads include collectionSymbol: "ocbadge" and omit name/email.
 */
export async function buildOpenCampusPayload(params: {
  template: CredentialTemplateRow;
  userId: string;
  username: string | null;
  profileUrl: string;
  holderOcId: string | null;
  holderAddress: string | null;
  holderName: string | null;
  holderEmail: string | null;
  awardedIso: string;
}): Promise<{ body: Record<string, unknown>; issuerReferenceId: string; achievementIdentifier: string }> {
  const {
    template,
    userId,
    username,
    profileUrl,
    holderOcId,
    holderAddress,
    holderName,
    holderEmail,
    awardedIso,
  } = params;

  const isOCA = !template.collection_symbol;

  const issuerRef = issuerReferenceId(template.id, userId);
  const achId = await achievementIdentifier(template.identifier_prefix, template.id, userId);

  const scopeId =
    template.scope_type === "course"
      ? String(template.course_id ?? "")
      : template.scope_type === "hackathon"
      ? String(template.hackathon_id ?? "")
      : template.id;

  // credentialSubject — OCA includes name + email; OCB does not
  const credentialSubject: Record<string, unknown> = {
    type: "Person",
    image: template.image_url,
    profileUrl,
    achievement: {
      name: template.name,
      identifier: achId,
      description: template.description,
      achievementType: template.achievement_type,
    },
    "ext:OC_CUSTOM:custom": {
      ...(typeof template.custom_metadata === "object" && template.custom_metadata != null
        ? template.custom_metadata as Record<string, unknown>
        : {}),
      "ext:OC_CUSTOM:corelia:scope_type": template.scope_type,
      "ext:OC_CUSTOM:corelia:scope_id": scopeId,
    },
  };

  if (isOCA) {
    if (holderName?.trim()) credentialSubject.name = holderName.trim();
    if (holderEmail?.trim()) credentialSubject.email = holderEmail.trim();
  }

  const credentialPayload: Record<string, unknown> = {
    validFrom: awardedIso,
    awardedDate: awardedIso,
    name: template.name,
    description: template.description,
    // Open Campus requires this public image URI to match
    // credentialSubject.image. A separate institution logo is not part of the
    // issuance contract and can cause the issuer's dry-run to reject the VC.
    image: template.image_url,
    credentialSubject,
  };

  const body: Record<string, unknown> = {
    credentialPayload,
    issuerReferenceId: issuerRef,
  };

  // OCB: include collectionSymbol. OCA: omit → OC platform defaults to OCA.
  if (!isOCA) {
    body.collectionSymbol = template.collection_symbol; // "ocbadge"
  }

  // OC `/issuer/vc` uses a `oneOf` schema for holder identity — it accepts
  // EXACTLY ONE of holderOcId or holderAddress. Sending both matches two
  // schema branches and fails with "must match exactly one schema in oneOf".
  // Prefer the OCID (OC resolves the bound wallet from it); only fall back to
  // the raw wallet address when the holder has no OCID.
  if (holderOcId?.trim()) {
    body.holderOcId = holderOcId.trim();
  } else if (holderAddress?.trim()) {
    body.holderAddress = holderAddress.trim();
  }

  void username;

  return { body, issuerReferenceId: issuerRef, achievementIdentifier: achId };
}

export function resolveMintNetwork(
  templateNetworkOverride: string | null | undefined,
  defaultNetwork: MintNetwork,
): MintNetwork {
  if (templateNetworkOverride === "mainnet" || templateNetworkOverride === "staging") {
    return templateNetworkOverride;
  }
  return defaultNetwork;
}
