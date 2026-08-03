import { createElement } from "react";
import { Award, Medal, Sparkles } from "lucide-react";

import type { BadgeItem } from "@/pages/achievements/types";
import { claimStatusFromIssuance } from "@/pages/achievements/utils/credentialState";
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
  error_message: string | null;
  network: string;
  status: string;
  show_on_profile: boolean | null;
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
    error_message: row.error_message ?? null,
    network: row.network === "mainnet" ? "mainnet" : "staging",
    status: row.status,
    show_on_profile: row.show_on_profile === true,
    display_snapshot: snapshot,
    template,
  };
}

export type CourseIssuanceInfo = {
  issuanceId: string;
  templateId: string | null;
  status: "pending" | "minted" | "failed";
  oc_credential_id: string | null;
  error_message: string | null;
  collectionSymbol: "ocbadge" | null;
};

function courseIssuancePriority(issuance: CourseIssuanceInfo): number {
  switch (
    claimStatusFromIssuance({
      status: issuance.status,
      ocCredentialId: issuance.oc_credential_id,
      errorMessage: issuance.error_message,
    })
  ) {
    case "claimed":
      return 4;
    case "needs_reconciliation":
      return 3;
    case "awaiting_holder_id":
    case "pending":
      return 2;
    case "failed":
      return 1;
    default:
      return 0;
  }
}

export async function fetchCourseIssuanceMapForUser(
  userId: string,
): Promise<Map<string, CourseIssuanceInfo>> {
  const { data, error } = await supabase
    .from("credential_issuances")
    .select(`
      id,
      template_id,
      status,
      oc_credential_id,
      oc_response,
      error_message,
      course_id,
      credential_templates!inner (collection_symbol)
    `)
    .eq("user_id", userId)
    .not("course_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const map = new Map<string, CourseIssuanceInfo>();
  for (const row of data ?? []) {
    const courseId = String(row.course_id ?? "");
    if (!courseId) continue;
    const ocCredentialId =
      row.oc_credential_id ?? extractOcCredentialId(row.oc_response);
    const next = {
      issuanceId: String(row.id),
      templateId: row.template_id ? String(row.template_id) : null,
      status: (row.status as CourseIssuanceInfo["status"]) ?? "pending",
      oc_credential_id: ocCredentialId,
      error_message: row.error_message ?? null,
      collectionSymbol:
        row.credential_templates?.[0]?.collection_symbol === "ocbadge" ? "ocbadge" : null,
    } satisfies CourseIssuanceInfo;
    const current = map.get(courseId);
    // One certificate card represents one course credential. Preserve a minted
    // historical credential over a newer failed/pending reissue so learners do
    // not lose the ability to view what was already issued to them.
    if (!current || courseIssuancePriority(next) > courseIssuancePriority(current)) {
      map.set(courseId, next);
    }
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
      error_message,
      network,
      status,
      show_on_profile,
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
        collection_symbol,
        trigger_type
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapIssuanceRow);
}

/** Credentials deliberately selected by a profile owner for public display. */
export async function fetchPublicProfileCredentialIssuances(
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
      error_message,
      network,
      status,
      show_on_profile,
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
        collection_symbol,
        trigger_type
      )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "minted")
    .eq("show_on_profile", true)
    .not("oc_credential_id", "is", null)
    .order("minted_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapIssuanceRow);
}

export async function setMyProfileCredentialVisibility(
  issuanceIds: string[],
): Promise<string[]> {
  type ProfileCredentialVisibilityRow = {
    issuance_id: string;
    show_on_profile: boolean;
  };
  const deduplicatedIds = [...new Set(issuanceIds)];
  const { data, error } = await supabase.rpc(
    "set_my_profile_credential_visibility",
    { p_issuance_ids: deduplicatedIds },
  );

  if (error) throw new Error(error.message);

  return ((data ?? []) as ProfileCredentialVisibilityRow[])
    .filter((row) => row.show_on_profile === true)
    .map((row) => String(row.issuance_id));
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

  // Admin Manual Mint reuses scope_type="activity_milestone" for OCA/OCB grants with
  // no course/hackathon anchor (see saveActivityMilestoneTemplate) — but those are not
  // auto-earned milestone badges, so trigger_type="manual" must not land in the
  // Milestones tab. Falling through to "course" lets the existing achievement_type
  // check (Badge/Award vs MicroCredential/Diploma/CertificateOfCompletion) route it
  // into the OCA/OCB tabs like any other credential.
  const credentialScope =
    tpl?.trigger_type !== "manual" &&
    (tpl?.scope_type === "hackathon" || tpl?.scope_type === "activity_milestone")
      ? tpl.scope_type
      : "course";

  const defaultStyle: ScopeStyle = {
    icon: createElement(Award, { className: "size-6 text-primary", "aria-hidden": true }),
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  };
  const { icon, color, bgColor, borderColor } = tpl
    ? styleForScope(credentialScope)
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
    // Preserve the course/template identity so a standalone course card, whose
    // optimistic id differs from the issuance UUID, can be reconciled after a
    // realtime refresh.
    courseId: row.course_id,
    templateId: row.template_id,
    // A mint response without a credential id can still represent an on-chain
    // credential (notably the OpenCampus duplicate path). Do not present it as
    // retryable failure until reconciliation has established the actual result.
    ocClaimStatus: claimStatusFromIssuance({
      status: row.status,
      ocCredentialId: resolvedCredentialId,
      errorMessage: row.error_message,
    }),
    ocCredentialUrl: ocUrl ?? undefined,
    ocTransactionHash: undefined,
    mintCredentialId: resolvedCredentialId,
    issuanceId: row.id,
    showOnProfile: row.show_on_profile,
    status: (row.status as "pending" | "minted" | "failed" | "awaiting_holder_id") ?? "failed",
    credentialScope,
    hackathonRole: tpl?.hackathon_role ?? undefined,
    collectionSymbol: tpl?.collection_symbol,
    achievementType: tpl?.achievement_type ?? undefined,
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
