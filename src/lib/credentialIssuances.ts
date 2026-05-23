import { createElement } from "react";
import { Award, Medal, Sparkles } from "lucide-react";

import type { BadgeItem } from "@/pages/achievements/types";
import { supabase } from "@/lib/supabase";
import type { CredentialIssuanceWithTemplate, CredentialTemplateSummary } from "@/types/credentials";

type IssuanceRow = {
  id: string;
  minted_at: string | null;
  oc_credential_id: string | null;
  network: string;
  status: string;
  credential_templates:
    | CredentialTemplateSummary
    | CredentialTemplateSummary[]
    | null;
};

function unwrapTemplate(
  t: IssuanceRow["credential_templates"],
): CredentialTemplateSummary | null {
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

export async function fetchMintedCredentialIssuancesForUser(
  userId: string,
): Promise<CredentialIssuanceWithTemplate[]> {
  const { data, error } = await supabase
    .from("credential_issuances")
    .select(
      `
      id,
      minted_at,
      oc_credential_id,
      network,
      status,
      credential_templates (
        id,
        scope_type,
        name,
        description,
        image_url,
        achievement_type
      )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "minted")
    .order("minted_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const row = raw as IssuanceRow;
    const template = unwrapTemplate(row.credential_templates);
    return {
      id: row.id,
      minted_at: row.minted_at,
      oc_credential_id: row.oc_credential_id,
      network: row.network === "mainnet" ? "mainnet" : "staging",
      status: row.status,
      template,
    };
  });
}

export function openCampusCredentialExplorerUrl(
  credentialId: string | null | undefined,
  _network?: CredentialIssuanceWithTemplate["network"],
): string | null {
  void _network;
  if (!credentialId?.trim()) return null;
  const id = credentialId.trim();
  return `https://id.opencampus.xyz/public/credentials?id=${encodeURIComponent(id)}`;
}

function badgeIconForScope(scope: CredentialTemplateSummary["scope_type"]) {
  switch (scope) {
    case "hackathon":
      return createElement(Medal, { className: "size-6 text-amber-600", "aria-hidden": true });
    case "activity_milestone":
      return createElement(Sparkles, { className: "size-6 text-violet-600", "aria-hidden": true });
    default:
      return createElement(Award, { className: "size-6 text-primary", "aria-hidden": true });
  }
}

export function issuanceToBadgeItem(row: CredentialIssuanceWithTemplate): BadgeItem {
  const tpl = row.template;
  const title = tpl?.name ?? "Credential";
  const description = tpl?.description ?? "";
  const ocUrl = openCampusCredentialExplorerUrl(row.oc_credential_id, row.network);
  const minted = row.minted_at ? new Date(row.minted_at).toLocaleDateString() : "—";

  const credentialScope =
    tpl?.scope_type === "hackathon" || tpl?.scope_type === "activity_milestone"
      ? tpl.scope_type
      : "course";

  return {
    id: row.id,
    title,
    description,
    icon: tpl
      ? badgeIconForScope(tpl.scope_type)
      : createElement(Award, { className: "size-6 text-primary", "aria-hidden": true }),
    color: "text-foreground",
    bgColor: "bg-surface-raised",
    borderColor: "border-border-subtle",
    earnedAt: minted,
    locked: false,
    category: "milestone",
    imageUrl: tpl?.image_url,
    ocClaimStatus: "claimed",
    ocCredentialUrl: ocUrl ?? undefined,
    ocTransactionHash: undefined,
    mintCredentialId: row.oc_credential_id,
    credentialScope,
  };
}

export function groupIssuancesByScope(rows: CredentialIssuanceWithTemplate[]): {
  course: CredentialIssuanceWithTemplate[];
  hackathon: CredentialIssuanceWithTemplate[];
  activity: CredentialIssuanceWithTemplate[];
} {
  const course: CredentialIssuanceWithTemplate[] = [];
  const hackathon: CredentialIssuanceWithTemplate[] = [];
  const activity: CredentialIssuanceWithTemplate[] = [];

  for (const r of rows) {
    const s = r.template?.scope_type;
    if (s === "hackathon") hackathon.push(r);
    else if (s === "activity_milestone") activity.push(r);
    else course.push(r);
  }

  return { course, hackathon, activity };
}
