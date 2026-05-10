import type { MintNetwork } from "./settings.ts";
import { achievementIdentifier, issuerReferenceId } from "./ids.ts";

export type CredentialTemplateRow = {
  id: string;
  scope_type: "course" | "hackathon" | "activity_milestone";
  course_id: string | null;
  hackathon_id: string | null;
  name: string;
  description: string;
  image_url: string;
  achievement_type: "Badge" | "Award";
  identifier_prefix: string;
  collection_symbol: string;
  custom_metadata: Record<string, unknown>;
  network_override?: string | null;
};

export async function buildOpenCampusPayload(params: {
  template: CredentialTemplateRow;
  userId: string;
  username: string | null;
  profileUrl: string;
  logoUrl: string;
  holderOcId: string | null;
  holderAddress: string | null;
  awardedIso: string;
}): Promise<{ body: Record<string, unknown>; issuerReferenceId: string; achievementIdentifier: string }> {
  const { template, userId, username, profileUrl, logoUrl, holderOcId, holderAddress, awardedIso } = params;

  const issuerRef = issuerReferenceId(template.identifier_prefix, userId);
  const achId = await achievementIdentifier(template.identifier_prefix, userId);

  const scopeId =
    template.scope_type === "course"
      ? String(template.course_id ?? "")
      : template.scope_type === "hackathon"
      ? String(template.hackathon_id ?? "")
      : template.id;

  const credentialPayload = {
    validFrom: awardedIso,
    awardedDate: awardedIso,
    description: template.description,
    image: logoUrl,
    credentialSubject: {
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
    },
  };

  const body: Record<string, unknown> = {
    credentialPayload,
    collectionSymbol: template.collection_symbol,
    issuerReferenceId: issuerRef,
  };

  if (holderOcId?.trim()) {
    body.holderOcId = holderOcId.trim();
  }
  if (holderAddress?.trim()) {
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
