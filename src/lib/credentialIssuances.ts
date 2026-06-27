import { createElement } from "react";
import { Award, Medal, Sparkles } from "lucide-react";

import type { BadgeItem, ClaimStatus } from "@/pages/achievements/types";
import { supabase } from "@/lib/supabase";
import type { CredentialIssuanceWithTemplate, CredentialTemplateSummary } from "@/types/credentials";

type IssuanceRow = {
  id: string;
  course_id: string | null;
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

export type CourseIssuanceInfo = {
  issuanceId: string;
  status: "pending" | "minted" | "failed";
  oc_credential_id: string | null;
  error_message: string | null;
};

export async function fetchCourseIssuanceMapForUser(
  userId: string,
): Promise<Map<string, CourseIssuanceInfo>> {
  const { data, error } = await supabase
    .from("credential_issuances")
    .select("id, status, oc_credential_id, error_message, course_id")
    .eq("user_id", userId)
    .not("course_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const map = new Map<string, CourseIssuanceInfo>();
  for (const row of data ?? []) {
    const courseId = String(row.course_id ?? "");
    if (!courseId || map.has(courseId)) continue;
    map.set(courseId, {
      issuanceId: String(row.id),
      status: (row.status as CourseIssuanceInfo["status"]) ?? "pending",
      oc_credential_id: row.oc_credential_id ?? null,
      error_message: row.error_message ?? null,
    });
  }
  return map;
}

export async function fetchMyCredentialIssuances(
  userId: string,
): Promise<CredentialIssuanceWithTemplate[]> {
  const { data, error } = await supabase
    .from("credential_issuances")
    .select(
      `
      id,
      course_id,
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
        thumbnail_url,
        achievement_type,
        hackathon_role,
        collection_symbol
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const row = raw as IssuanceRow;
    const template = unwrapTemplate(row.credential_templates);
    return {
      id: row.id,
      course_id: row.course_id ?? null,
      minted_at: row.minted_at,
      oc_credential_id: row.oc_credential_id,
      network: row.network === "mainnet" ? "mainnet" : "staging",
      status: row.status,
      template,
    };
  });
}

export async function fetchMintedCredentialIssuancesForUser(
  userId: string,
): Promise<CredentialIssuanceWithTemplate[]> {
  const { data, error } = await supabase
    .from("credential_issuances")
    .select(
      `
      id,
      course_id,
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
        thumbnail_url,
        achievement_type,
        hackathon_role,
        collection_symbol
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
      course_id: row.course_id ?? null,
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
  opts?: {
    /** Holder OCID (e.g. "alice.edu") — needed for the credential details page. */
    username?: string | null;
    /** "occredential" for OCA, "ocbadge" for OCB. Defaults to "occredential". */
    nftCollection?: "occredential" | "ocbadge";
  },
): string | null {
  if (!credentialId?.trim()) return null;
  const id = credentialId.trim();
  const base = import.meta.env.VITE_OCID_SANDBOX === "true"
    ? "https://id.sandbox.opencampus.xyz"
    : "https://id.opencampus.xyz";
  const username = opts?.username?.trim();
  const nftCollection = opts?.nftCollection ?? "occredential";
  // With the holder OCID we can deep-link to the specific credential details page;
  // otherwise fall back to the holder's public credentials list.
  if (username) {
    const u = username.endsWith(".edu") ? username : `${username}.edu`;
    return `${base}/public/credentials/details?username=${encodeURIComponent(u)}&id=${encodeURIComponent(id)}&nftCollection=${encodeURIComponent(nftCollection)}`;
  }
  return `${base}/public/credentials?id=${encodeURIComponent(id)}`;
}

type ScopeStyle = {
  icon: ReturnType<typeof createElement>;
  color: string;
  bgColor: string;
  borderColor: string;
};

function styleForScope(scope: CredentialTemplateSummary["scope_type"]): ScopeStyle {
  switch (scope) {
    case "hackathon":
      return {
        icon: createElement(Medal, { className: "size-6 text-warning", "aria-hidden": true }),
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/20",
      };
    case "activity_milestone":
      return {
        icon: createElement(Sparkles, { className: "size-6 text-violet-600", "aria-hidden": true }),
        color: "text-violet-600",
        bgColor: "bg-violet-500/10",
        borderColor: "border-violet-500/20",
      };
    default:
      // course → OCA
      return {
        icon: createElement(Award, { className: "size-6 text-primary", "aria-hidden": true }),
        color: "text-primary",
        bgColor: "bg-primary/10",
        borderColor: "border-primary/20",
      };
  }
}

export function issuanceToBadgeItem(row: CredentialIssuanceWithTemplate, username?: string | null): BadgeItem {
  const tpl = row.template;
  const title = tpl?.name ?? "Credential";
  const description = tpl?.description ?? "";
  const ocUrl = openCampusCredentialExplorerUrl(row.oc_credential_id, {
    username,
    nftCollection: tpl?.collection_symbol === "ocbadge" ? "ocbadge" : "occredential",
  });
  const minted = row.minted_at ? new Date(row.minted_at).toLocaleDateString() : "—";

  const credentialScope =
    tpl?.scope_type === "hackathon" || tpl?.scope_type === "activity_milestone"
      ? tpl.scope_type
      : "course";

  const defaultStyle: ScopeStyle = {
    icon: createElement(Award, { className: "size-6 text-primary", "aria-hidden": true }),
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  };
  const { icon, color, bgColor, borderColor } = tpl
    ? styleForScope(tpl.scope_type)
    : defaultStyle;

  return {
    id: row.id,
    title,
    description,
    icon,
    color,
    bgColor,
    borderColor,
    earnedAt: minted,
    locked: false,
    category: "milestone",
    // thumbnail_url for frontend display; image_url (full-res) stays in OC payload only
    imageUrl: tpl?.thumbnail_url ?? tpl?.image_url,
    // Claim status is derived from row status for our realtime pipeline
    ocClaimStatus: row.status === "minted" ? "claimed" : (row.status as ClaimStatus) ?? "failed",
    ocCredentialUrl: ocUrl ?? undefined,
    ocTransactionHash: undefined,
    mintCredentialId: row.oc_credential_id,
    issuanceId: row.id,
    status: (row.status as "pending" | "minted" | "failed" | "awaiting_holder_id") ?? "failed",
    credentialScope,
    hackathonRole: tpl?.hackathon_role ?? undefined,
    collectionSymbol: tpl?.collection_symbol,
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
