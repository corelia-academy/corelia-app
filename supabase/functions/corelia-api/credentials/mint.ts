import type { SupabaseClient } from "../lib/supabase.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { buildCredentialMintEmail, type CredentialMintEmailKind } from "./emails.ts";
import { buildOpenCampusPayload, resolveMintNetwork, type CredentialTemplateRow } from "./oc_payload.ts";
import { extractOcCredentialId } from "./oc_response.ts";
import {
  getAppBaseUrl,
  getCoreliaLogoUrl,
  getDefaultMintNetwork,
  getMintEndpoint,
  openCampusApiKey,
  type MintNetwork,
} from "./settings.ts";

type IssuanceRow = {
  id: string;
  template_id: string;
  user_id: string;
  course_id: string | null;
  hackathon_id: string | null;
  issuer_reference_id: string;
  network: MintNetwork;
  status: string;
  retry_count: number;
  credential_templates: CredentialTemplateRow | null;
};

async function fetchIssuanceWithTemplate(
  db: SupabaseClient,
  issuanceId: string,
): Promise<IssuanceRow | null> {
  const { data, error } = await db.from("credential_issuances").select(`
    id,
    template_id,
    user_id,
    course_id,
    hackathon_id,
    issuer_reference_id,
    network,
    status,
    retry_count,
    credential_templates (
      id,
      scope_type,
      course_id,
      hackathon_id,
      name,
      description,
      image_url,
      thumbnail_url,
      achievement_type,
      identifier_prefix,
      collection_symbol,
      custom_metadata,
      network_override,
      trigger_type
    )
  `).eq("id", issuanceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const tpl = row.credential_templates as CredentialTemplateRow | CredentialTemplateRow[] | null;
  const template = Array.isArray(tpl) ? tpl[0] ?? null : tpl;
  return {
    id: String(row.id),
    template_id: String(row.template_id),
    user_id: String(row.user_id),
    course_id: row.course_id != null ? String(row.course_id) : null,
    hackathon_id: row.hackathon_id != null ? String(row.hackathon_id) : null,
    issuer_reference_id: String(row.issuer_reference_id),
    network: row.network as MintNetwork,
    status: String(row.status),
    retry_count: Number(row.retry_count ?? 0),
    credential_templates: template,
  };
}

async function getUserEmailLocale(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.auth.admin.getUserById(userId);
  const meta = data?.user?.user_metadata;
  if (meta && typeof meta === "object" && "locale" in meta) {
    const locale = (meta as { locale?: unknown }).locale;
    return typeof locale === "string" ? locale : null;
  }
  return null;
}

/** Resolve the email kind from scope_type + whether the credential is OCA. */
function resolveMintEmailKind(
  scopeType: string,
  isOCA: boolean,
  triggerType?: string | null,
): CredentialMintEmailKind {
  // Admin Manual Mint grants reuse scope_type="activity_milestone" (no course/hackathon
  // anchor) but are not auto-earned milestones — must not get the "cột mốc" wording.
  // OCA already uses the certificate copy; OCB falls back to the generic badge copy
  // ("course" kind), same treatment as a course-tied OCB.
  if (triggerType === "manual") return isOCA ? "course_oca" : "course";
  if (scopeType === "hackathon") return "hackathon";
  if (scopeType === "activity_milestone") return isOCA ? "course_oca" : "milestone";
  // course — OCB uses generic "course", OCA uses "course_oca"
  return isOCA ? "course_oca" : "course";
}

async function sendMintEmail(params: {
  to: string;
  scopeType: string;
  isOCA: boolean;
  triggerType?: string | null;
  badgeName: string;
  profileUrl: string;
  credentialId?: string | null;
  imageUrl?: string | null;
  locale?: string | null;
}): Promise<void> {
  const kind = resolveMintEmailKind(params.scopeType, params.isOCA, params.triggerType);
  const { subject, html } = buildCredentialMintEmail({
    kind,
    badgeName: params.badgeName,
    profileUrl: params.profileUrl,
    credentialId: params.credentialId,
    imageUrl: params.imageUrl,
    locale: params.locale,
  });

  await sendTransactionalEmailViaResend({
    db: params.db,
    mailType: "credential_minted",
    to: [params.to],
    subject,
    html,
  });
}

/** Insert an in-app notification row for a successfully minted OC credential. */
async function insertCredentialNotification(
  db: SupabaseClient,
  params: {
    userId: string;
    credentialName: string;
    scopeType: string;
    /** Full-res image URL (for fallback). */
    imageUrl: string;
    /** Thumbnail URL preferred for in-app display; fallback to imageUrl if null. */
    thumbnailUrl: string | null | undefined;
    ocCredentialId: string | null;
    isOCA: boolean;
  },
): Promise<void> {
  try {
    await db.from("user_notifications").insert({
      user_id: params.userId,
      type: "oc_credential_minted",
      payload: {
        credential_name: params.credentialName,
        scope_type: params.scopeType,
        // Use thumbnail for notification bell display; frontend falls back to image_url if null
        image_url: params.thumbnailUrl?.trim() || params.imageUrl,
        oc_credential_id: params.ocCredentialId,
        is_oca: params.isOCA,
      },
    });
  } catch (e) {
    // Non-fatal: log but don't fail the mint
    console.error("[corelia-api] credential notification insert failed", e);
  }
}

/** POST OpenCampus issuer VC once; updates issuance row. */
export async function mintCredentialOnce(db: SupabaseClient, issuanceId: string): Promise<{
  ok: boolean;
  duplicate?: boolean;
  error?: string;
}> {
  const row = await fetchIssuanceWithTemplate(db, issuanceId);
  if (!row?.credential_templates) {
    return { ok: false, error: "Issuance or template not found" };
  }
  if (row.status === "minted") {
    return { ok: true };
  }

  const template = row.credential_templates as CredentialTemplateRow & { network_override?: string | null };

  // Resolve the holder before touching any settings lookup (network, mint
  // endpoint, logo, base URL, email locale) — those calls throw on missing
  // config, and doing them ahead of the holder check used to leave a
  // freshly-inserted issuance orphaned at status='pending', error_message=NULL
  // (invisible to credentials.retryPending, which only matches the literal
  // 'awaiting_holder_id') whenever a setting was missing. Fetching the holder
  // first, and gating everything else behind a single try/catch, guarantees
  // the row always lands on a terminal, retry-visible state.
  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("username, email, full_name, ocid, ocid_eth_address")
    .eq("id", row.user_id)
    .maybeSingle();
  if (profErr) {
    await db.from("credential_issuances").update({
      status: "failed",
      error_message: profErr.message,
      retry_count: row.retry_count + 1,
    }).eq("id", issuanceId);
    return { ok: false, error: profErr.message };
  }

  const username = profile?.username != null ? String(profile.username) : null;
  const holderOcId = profile?.ocid != null ? String(profile.ocid) : null;
  const holderAddress = profile?.ocid_eth_address != null ? String(profile.ocid_eth_address) : null;
  const email = profile?.email != null ? String(profile.email).trim() : "";
  const holderName = profile?.full_name != null ? String(profile.full_name).trim() || null : null;

  // If user has neither OC ID nor wallet address, hold the issuance instead of
  // calling the OC API and receiving a guaranteed rejection.
  // The issuance stays 'pending' with error_message='awaiting_holder_id' so that
  // credentials.retryPending can re-trigger it once the user connects their OCID.
  if (!holderOcId?.trim() && !holderAddress?.trim()) {
    await db.from("credential_issuances").update({
      error_message: "awaiting_holder_id",
    }).eq("id", issuanceId);
    return { ok: false, error: "awaiting_holder_id" };
  }

  let ocResponseJson: unknown = null;
  let ocCredentialId: string | null = null;
  try {
    const defaultNet = await getDefaultMintNetwork(db);
    const network = resolveMintNetwork(template.network_override, defaultNet);

    const apiKey = openCampusApiKey(network);
    if (!apiKey) {
      await db.from("credential_issuances").update({
        status: "failed",
        error_message: "Missing OPENCAMPUS_API_KEY_* secret",
        retry_count: row.retry_count + 1,
      }).eq("id", issuanceId);
      return { ok: false, error: "Missing API key" };
    }

    const [logoUrl, baseUrl, endpoint, emailLocale] = await Promise.all([
      getCoreliaLogoUrl(db),
      getAppBaseUrl(db),
      getMintEndpoint(db, network),
      getUserEmailLocale(db, row.user_id),
    ]);

    const profilePath = username ? `/u/${encodeURIComponent(username)}` : `/account`;
    const profileUrl = `${baseUrl}${profilePath}`;

    // OCA credential art is always the generic template image — never a
    // learner-name-rendered certificate. Printing the holder's name on an
    // image attached to an immutable on-chain credential would leak PII
    // permanently onto the public ledger.
    const isOCA = !template.collection_symbol;
    const mintEmailImageUrl = template.image_url;

    const awardedIso = new Date().toISOString();
    const { body: ocBody } = await buildOpenCampusPayload({
      template,
      userId: row.user_id,
      username,
      profileUrl,
      logoUrl,
      holderOcId,
      holderAddress,
      holderName,
      holderEmail: email || null,
      awardedIso,
    });

    const issuerReferenceId = String(ocBody.issuerReferenceId ?? "");
    if (!issuerReferenceId) throw new Error("Missing issuer reference id");

    const { error: pendingErr } = await db.from("credential_issuances").update({
      // Failed legacy issuances are retried with the collision-safe V2 reference.
      issuer_reference_id: issuerReferenceId,
      oc_request_payload: ocBody as Record<string, unknown>,
      network,
      error_message: null,
    }).eq("id", issuanceId);
    if (pendingErr) throw new Error(pendingErr.message);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(ocBody),
    });
    const text = await res.text();
    try {
      ocResponseJson = JSON.parse(text);
    } catch {
      ocResponseJson = { raw: text };
    }
    if (!res.ok) {
      const msg = typeof ocResponseJson === "object" && ocResponseJson && "message" in ocResponseJson
        ? String((ocResponseJson as { message?: unknown }).message)
        : text.slice(0, 500);
      const dup = /duplicate|already exists|unique/i.test(text + msg);
      if (dup) {
        // Try to extract the credential ID from the error response body — OC may
        // return it even on a duplicate rejection.
        ocCredentialId = extractOcCredentialId(ocResponseJson);
      }
      const credentialIdUnresolved = dup && !ocCredentialId?.trim();
      await db.from("credential_issuances").update({
        status: dup ? "minted" : "failed",
        oc_response: ocResponseJson as Record<string, unknown>,
        error_message: dup
          ? credentialIdUnresolved
            ? "duplicate_issuance_unresolved"
            : null
          : `HTTP ${res.status}: ${msg}`,
        retry_count: row.retry_count + 1,
        ...(dup
          ? {
            minted_at: awardedIso,
            oc_credential_id: ocCredentialId,
          }
          : {}),
      }).eq("id", issuanceId);
      if (dup) {
        // A duplicate response proves the credential may already exist, but we
        // cannot safely send a success notification or expose retry until its
        // on-chain id has been reconciled from a response/lookup.
        if (credentialIdUnresolved) return { ok: true, duplicate: true };
        await Promise.all([
          email
            ? sendMintEmail({
              to: email,
              scopeType: template.scope_type,
              isOCA,
              triggerType: template.trigger_type,
              badgeName: template.name,
              profileUrl,
              credentialId: ocCredentialId,
              imageUrl: mintEmailImageUrl,
              locale: emailLocale,
            })
            : Promise.resolve(),
          insertCredentialNotification(db, {
            userId: row.user_id,
            credentialName: template.name,
            scopeType: template.scope_type,
            imageUrl: template.image_url,
            thumbnailUrl: template.thumbnail_url,
            ocCredentialId,
            isOCA,
          }),
        ]);
        return { ok: true, duplicate: true };
      }
      return { ok: false, error: msg };
    }

    const parsed = ocResponseJson as Record<string, unknown>;
    ocCredentialId = extractOcCredentialId(parsed);
    const credentialIdUnresolved = !ocCredentialId?.trim();

    await db.from("credential_issuances").update({
      status: "minted",
      minted_at: awardedIso,
      oc_response: parsed,
      oc_credential_id: ocCredentialId,
      error_message: credentialIdUnresolved ? "credential_id_unresolved" : null,
      retry_count: row.retry_count,
    }).eq("id", issuanceId);

    if (credentialIdUnresolved) {
      // The issuer response did not include a parsable ID. Keep the terminal
      // result and show reconciliation rather than inviting a blind retry.
      return { ok: true };
    }

    await Promise.all([
      email
        ? sendMintEmail({
          to: email,
          scopeType: template.scope_type,
          isOCA,
          triggerType: template.trigger_type,
          badgeName: template.name,
          profileUrl,
          credentialId: ocCredentialId,
          imageUrl: mintEmailImageUrl,
          locale: emailLocale,
        })
        : Promise.resolve(),
      insertCredentialNotification(db, {
        userId: row.user_id,
        credentialName: template.name,
        scopeType: template.scope_type,
        imageUrl: template.image_url,
        thumbnailUrl: template.thumbnail_url,
        ocCredentialId,
        isOCA,
      }),
    ]);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("credential_issuances").update({
      status: "failed",
      oc_response: ocResponseJson as Record<string, unknown>,
      error_message: msg,
      retry_count: row.retry_count + 1,
    }).eq("id", issuanceId);
    return { ok: false, error: msg };
  }
}
