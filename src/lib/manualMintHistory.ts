import { supabase } from "@/lib/supabase";
import { openCampusCredentialExplorerUrl } from "@/lib/credentialIssuances";

export type ManualMintHistoryRow = {
  id: string;
  templateId: string;
  templateName: string;
  templateImageUrl: string;
  templateKind: "oca" | "ocb";
  templateScope: string;
  userId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientOcid: string | null;
  recipientAvatarUrl: string | null;
  grantedBy: string | null;
  granterName: string | null;
  granterEmail: string | null;
  grantedReason: string | null;
  status: "pending" | "minted" | "failed" | "awaiting_signup";
  network: "staging" | "mainnet";
  ocCredentialId: string | null;
  explorerUrl: string | null;
  mintedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  isGhost: boolean;
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
    achievement_type: string;
    collection_symbol: string | null;
    scope_type: string;
    trigger_type: string;
    description: string | null;
  } | null;
};

type PendingGhostQueryResult = {
  id: string;
  email: string;
  template_id: string;
  network: string;
  granted_reason: string | null;
  created_at: string;
  credential_templates: {
    id: string;
    name: string;
    image_url: string;
    achievement_type: string;
    collection_symbol: string | null;
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
  // 1. Query standard issuances
  const issuancesPromise = supabase
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
        achievement_type,
        collection_symbol,
        scope_type,
        trigger_type,
        description
      )
    `)
    .order("created_at", { ascending: false });

  // 2. Query pending ghost issuances (waiting for user signup)
  const ghostPromise = supabase
    .from("pending_credential_issuances")
    .select(`
      id,
      email,
      template_id,
      network,
      granted_reason,
      created_at,
      credential_templates (
        id,
        name,
        image_url,
        achievement_type,
        collection_symbol,
        scope_type,
        trigger_type,
        description
      )
    `)
    .order("created_at", { ascending: false });

  const [
    { data: rawIssuances, error: issErr },
    { data: rawGhosts, error: ghostErr },
  ] = await Promise.all([issuancesPromise, ghostPromise]);

  if (issErr) {
    throw new Error(issErr.message);
  }
  if (ghostErr) {
    console.warn("Could not load pending_credential_issuances:", ghostErr.message);
  }

  const issuances = (rawIssuances ?? []) as unknown as IssuanceQueryResult[];
  const ghosts = (rawGhosts ?? []) as unknown as PendingGhostQueryResult[];

  // Filter issuances for manual grants: either granted_by is set or trigger_type is 'manual'
  const manualIssuances = issuances.filter((item) => {
    const tpl = item.credential_templates;
    return Boolean(item.granted_by) || (tpl && tpl.trigger_type === "manual");
  });

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

  const mappedIssuances: ManualMintHistoryRow[] = manualIssuances.map((item) => {
    const tpl = item.credential_templates;
    const recipient = profileMap.get(item.user_id);
    const granter = item.granted_by ? profileMap.get(item.granted_by) : null;

    const isOcb =
      tpl?.collection_symbol === "ocbadge" ||
      tpl?.achievement_type === "Badge" ||
      tpl?.achievement_type === "Award";
    const kind: "oca" | "ocb" = isOcb ? "ocb" : "oca";
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
      isGhost: false,
    };
  });

  const mappedGhosts: ManualMintHistoryRow[] = ghosts.map((item) => {
    const tpl = item.credential_templates;
    const isOcb =
      tpl?.collection_symbol === "ocbadge" ||
      tpl?.achievement_type === "Badge" ||
      tpl?.achievement_type === "Award";
    const kind: "oca" | "ocb" = isOcb ? "ocb" : "oca";

    return {
      id: item.id,
      templateId: item.template_id,
      templateName: tpl?.name ?? "Unknown Credential",
      templateImageUrl: tpl?.image_url ?? "",
      templateKind: kind,
      templateScope: tpl?.scope_type ?? "activity_milestone",
      userId: null,
      recipientName: "Chờ tạo tài khoản",
      recipientEmail: item.email,
      recipientOcid: null,
      recipientAvatarUrl: null,
      grantedBy: null,
      granterName: "Admin",
      granterEmail: null,
      grantedReason: item.granted_reason ?? null,
      status: "awaiting_signup",
      network: item.network === "mainnet" ? "mainnet" : "staging",
      ocCredentialId: null,
      explorerUrl: null,
      mintedAt: null,
      createdAt: item.created_at,
      errorMessage: null,
      isGhost: true,
    };
  });

  // Combine and sort by createdAt descending
  return [...mappedIssuances, ...mappedGhosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function revokeManualGrant(id: string, isGhost: boolean): Promise<void> {
  if (isGhost) {
    const { error } = await supabase
      .from("pending_credential_issuances")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }

  // If standard issuance pending, delete row
  const { error } = await supabase
    .from("credential_issuances")
    .delete()
    .eq("id", id)
    .in("status", ["pending", "failed"]);

  if (error) throw new Error(error.message);
}

export async function retryManualGrant(issuanceId: string): Promise<{
  ok: boolean;
  status?: string;
  message?: string;
}> {
  const { callCoreliaApi } = await import("@/lib/coreliaEdgeApi");
  return await callCoreliaApi<{
    ok: boolean;
    status?: string;
    message?: string;
    stillFailed?: number;
  }>("credentials.retryPending", { issuanceId });
}
