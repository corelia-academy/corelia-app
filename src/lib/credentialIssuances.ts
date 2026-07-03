import { createElement } from "react";
import { Award, Medal, Sparkles } from "lucide-react";

import type { BadgeItem, ClaimStatus } from "@/pages/achievements/types";
import {
  normalizeCredentialDisplaySnapshot,
  templateSummaryFromSnapshot,
} from "@/lib/credentialDisplaySnapshot";
import { supabase } from "@/lib/supabase";
import type {
  CredentialDisplaySnapshot,
  CredentialIssuanceWithTemplate,
  CredentialTemplateSummary,
} from "@/types/credentials";

type IssuanceRow = {
  id: string;
  template_id: string | null;
  course_id: string | null;
  hackathon_id: string | null;
  created_at: string | null;
  minted_at: string | null;
  oc_credential_id: string | null;
  oc_response: unknown;
  network: string;
  status: string;
  display_snapshot: unknown;
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

function mapIssuanceRow(raw: unknown): CredentialIssuanceWithTemplate {
  const row = raw as IssuanceRow;
  const snapshot: CredentialDisplaySnapshot | null =
    normalizeCredentialDisplaySnapshot(row.display_snapshot);
  const template =
    unwrapTemplate(row.credential_templates) ??
    templateSummaryFromSnapshot(snapshot, row.template_id ?? null);

  return {
    id: row.id,
    template_id: row.template_id ?? null,
    course_id: row.course_id ?? null,
    hackathon_id: row.hackathon_id ?? null,
    created_at: row.created_at ?? null,
    minted_at: row.minted_at,
    oc_credential_id: row.oc_credential_id,
    oc_response: row.oc_response,
    network: row.network === "mainnet" ? "mainnet" : "staging",
    status: row.status,
    display_snapshot: snapshot,
    template,
  };
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
      template_id,
      course_id,
      hackathon_id,
      created_at,
      minted_at,
      oc_credential_id,
      oc_response,
      network,
      status,
      display_snapshot,
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

  return (data ?? []).map(mapIssuanceRow);
}

export async function fetchMintedCredentialIssuancesForUser(
  userId: string,
): Promise<CredentialIssuanceWithTemplate[]> {
  const { data, error } = await supabase
    .from("credential_issuances")
    .select(
      `
      id,
      template_id,
      course_id,
      hackathon_id,
      created_at,
      minted_at,
      oc_credential_id,
      oc_response,
      network,
      status,
      display_snapshot,
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

  return (data ?? []).map(mapIssuanceRow);
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
  const base = import.meta.env.VITE_OCID_SANDBOX === "true"
    ? "https://id.sandbox.opencampus.xyz"
    : "https://id.opencampus.xyz";

  const id = credentialId?.trim();
  const username = opts?.username?.trim();
  const nftCollection = opts?.nftCollection ?? "occredential";

  if (!id) {
    if (username) {
      const u = username.endsWith(".edu") ? username : `${username}.edu`;
      return `${base}/public/credentials?username=${encodeURIComponent(u)}`;
    }
    return null;
  }

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

  // Backfill oc_credential_id on-the-fly from oc_response if missing in DB
  let resolvedCredentialId = row.oc_credential_id;
  if (!resolvedCredentialId?.trim() && row.oc_response) {
    resolvedCredentialId = extractOcCredentialId(row.oc_response);
  }

  const ocUrl = openCampusCredentialExplorerUrl(resolvedCredentialId, {
    username,
    nftCollection: tpl?.collection_symbol === "ocbadge" ? "ocbadge" : "occredential",
  });
  const issuedAt = row.minted_at ?? row.display_snapshot?.issued_at ?? row.created_at;
  const minted = issuedAt ? new Date(issuedAt).toLocaleDateString() : "—";

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
    imageUrl: tpl?.thumbnail_url || tpl?.image_url || undefined,
    // Claim status is derived from row status for our realtime pipeline.
    // "claimed" requires status=minted AND a valid resolvedCredentialId.
    // minted without oc_credential_id = incomplete mint → treat as failed.
    ocClaimStatus:
      row.status === "minted"
        ? resolvedCredentialId
          ? "claimed"
          : "failed"
        : (row.status as ClaimStatus) ?? "failed",
    ocCredentialUrl: ocUrl ?? undefined,
    ocTransactionHash: undefined,
    mintCredentialId: resolvedCredentialId,
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

export function uuidToTokenId(value: string): string | null {
  const hex = value.replace(/^urn:uuid:/i, "").replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  try {
    return BigInt("0x" + hex).toString();
  } catch {
    return null;
  }
}

function extractOcCredentialIdFromText(text: string): string | null {
  const numeric = text.match(/\b(?:credentialId|credential_id|tokenId|token_id)\s*[:=]\s*(\d+)\b/i)?.[1];
  if (numeric) return numeric;

  const urn = text.match(/\burn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
  if (urn) return uuidToTokenId(urn) ?? urn;

  return null;
}

function collectNestedStrings(value: unknown, out: string[], seen: WeakSet<object>): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (value == null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectNestedStrings(item, out, seen);
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectNestedStrings(item, out, seen);
  }
}

export function extractOcCredentialId(response: unknown): string | null {
  if (typeof response === "string") return extractOcCredentialIdFromText(response);
  if (response == null || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  const vc = (root.vc && typeof root.vc === "object" ? root.vc : root) as Record<string, unknown>;

  const directVal =
    vc.tokenId ||
    vc.token_id ||
    vc.credentialId ||
    vc.credential_id ||
    root.tokenId ||
    root.token_id ||
    root.credentialId ||
    root.credential_id ||
    null;
  const direct: string | null = directVal ? String(directVal) : null;
  if (direct && /^\d+$/.test(direct.trim())) return direct.trim();

  const rawIdVal = vc.id || root.id || direct || "";
  const rawId: string = String(rawIdVal);
  if (rawId.trim()) {
    return uuidToTokenId(rawId.trim()) ?? rawId.trim();
  }

  const nestedStrings: string[] = [];
  collectNestedStrings(root, nestedStrings, new WeakSet<object>());
  for (const candidate of nestedStrings) {
    const extracted = extractOcCredentialIdFromText(candidate);
    if (extracted) return extracted;
  }

  return null;
}
