import { supabase } from "@/lib/supabase";
import { openCampusCredentialExplorerUrl } from "@/lib/credentialIssuances";

export type ManualMintHistoryRow = {
  id: string;
  templateId: string;
  templateName: string;
  templateImageUrl: string;
  templateKind: "oca" | "ocb";
  templateScope: string;
  userId: string;
  recipientName: string;
  recipientEmail: string;
  recipientOcid: string | null;
  recipientAvatarUrl: string | null;
  grantedBy: string | null;
  granterName: string | null;
  granterEmail: string | null;
  grantedReason: string | null;
  status: "pending" | "minted" | "failed" | "revoked";
  network: "staging" | "mainnet";
  ocCredentialId: string | null;
  explorerUrl: string | null;
  mintedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
};

type IssuanceQueryResult = {
  id: string;
  template_id: string;
  user_id: string;
  granted_by: string | null;
  granted_reason: string | null;
  status: string;
  network: string;
  created_at: string;
  minted_at: string | null;
  oc_credential_id: string | null;
  error_message: string | null;
  credential_templates: {
    id: string;
    name: string;
    image_url: string;
    kind: string;
    scope_type: string;
    trigger_type: string;
    description: string | null;
  } | null;
};

type ProfileQueryResult = {
  id: string;
  full_name: string | null;
  email: string | null;
  ocid: string | null;
  avatar_url: string | null;
};

export async function listManualMintHistoryForAdmin(): Promise<ManualMintHistoryRow[]> {
  const { data: rawIssuances, error: issErr } = await supabase
    .from("credential_issuances")
    .select(`
      id,
      template_id,
      user_id,
      granted_by,
      granted_reason,
      status,
      network,
      created_at,
      minted_at,
      oc_credential_id,
      error_message,
      credential_templates (
        id,
        name,
        image_url,
        kind,
        scope_type,
        trigger_type,
        description
      )
    `)
    .order("created_at", { ascending: false });

  if (issErr) {
    throw new Error(issErr.message);
  }

  const issuances = (rawIssuances ?? []) as unknown as IssuanceQueryResult[];

  // Filter for manual grants: either granted_by is set or trigger_type is 'manual'
  const manualIssuances = issuances.filter((item) => {
    const tpl = item.credential_templates;
    return Boolean(item.granted_by) || (tpl && tpl.trigger_type === "manual");
  });

  if (manualIssuances.length === 0) {
    return [];
  }

  // Collect unique user IDs for recipients and granters
  const userIds = Array.from(
    new Set(
      manualIssuances
        .flatMap((r) => [r.user_id, r.granted_by])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profileMap = new Map<string, ProfileQueryResult>();

  if (userIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, ocid, avatar_url")
      .in("id", userIds);

    if (!profErr && profiles) {
      for (const p of profiles as ProfileQueryResult[]) {
        profileMap.set(p.id, p);
      }
    }
  }

  return manualIssuances.map((item): ManualMintHistoryRow => {
    const tpl = item.credential_templates;
    const recipient = profileMap.get(item.user_id);
    const granter = item.granted_by ? profileMap.get(item.granted_by) : null;

    const kind: "oca" | "ocb" = tpl?.kind === "ocb" ? "ocb" : "oca";
    const nftCollection = kind === "ocb" ? "ocbadge" : "occredential";
    const explorerUrl = openCampusCredentialExplorerUrl(item.oc_credential_id, {
      username: recipient?.ocid ?? null,
      nftCollection,
    });

    return {
      id: item.id,
      templateId: item.template_id,
      templateName: tpl?.name ?? "Unknown Credential",
      templateImageUrl: tpl?.image_url ?? "",
      templateKind: kind,
      templateScope: tpl?.scope_type ?? "activity_milestone",
      userId: item.user_id,
      recipientName: recipient?.full_name?.trim() || "Chưa đặt tên",
      recipientEmail: recipient?.email ?? "",
      recipientOcid: recipient?.ocid ?? null,
      recipientAvatarUrl: recipient?.avatar_url ?? null,
      grantedBy: item.granted_by,
      granterName: granter?.full_name?.trim() || granter?.email || "Admin",
      granterEmail: granter?.email ?? null,
      grantedReason: item.granted_reason ?? null,
      status: (item.status as ManualMintHistoryRow["status"]) || "pending",
      network: item.network === "mainnet" ? "mainnet" : "staging",
      ocCredentialId: item.oc_credential_id,
      explorerUrl,
      mintedAt: item.minted_at,
      createdAt: item.created_at,
      errorMessage: item.error_message,
    };
  });
}
