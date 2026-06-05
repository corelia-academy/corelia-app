import type { SupabaseClient } from "../lib/supabase.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { buildCredentialMintEmail, type CredentialMintEmailKind } from "./emails.ts";
import { buildOpenCampusPayload, resolveMintNetwork, type CredentialTemplateRow } from "./oc_payload.ts";
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
      network_override
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
function resolveMintEmailKind(scopeType: string, isOCA: boolean): CredentialMintEmailKind {
  if (scopeType === "hackathon") return "hackathon";
  if (scopeType === "activity_milestone") return "milestone";
  // course — OCB uses generic "course", OCA uses "course_oca"
  return isOCA ? "course_oca" : "course";
}

async function sendMintEmail(params: {
  to: string;
  scopeType: string;
  isOCA: boolean;
  badgeName: string;
  profileUrl: string;
  credentialId?: string | null;
  imageUrl?: string | null;
  locale?: string | null;
}): Promise<void> {
  const kind = resolveMintEmailKind(params.scopeType, params.isOCA);
  const { subject, html } = buildCredentialMintEmail({
    kind,
    badgeName: params.badgeName,
    profileUrl: params.profileUrl,
    credentialId: params.credentialId,
    imageUrl: params.imageUrl,
    locale: params.locale,
  });

  await sendTransactionalEmailViaResend({
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

  const [{ data: profile, error: profErr }, logoUrl, baseUrl, endpoint] = await Promise.all([
    db.from("profiles").select("username, email, full_name, ocid, ocid_eth_address").eq("id", row.user_id).maybeSingle(),
    getCoreliaLogoUrl(db),
    getAppBaseUrl(db),
    getMintEndpoint(db, network),
  ]);
  if (profErr) throw new Error(profErr.message);

  const username = profile?.username != null ? String(profile.username) : null;
  const holderOcId = profile?.ocid != null ? String(profile.ocid) : null;
  const holderAddress = profile?.ocid_eth_address != null ? String(profile.ocid_eth_address) : null;
  const email = profile?.email != null ? String(profile.email).trim() : "";
  const holderName = profile?.full_name != null ? String(profile.full_name).trim() || null : null;
  const emailLocale = await getUserEmailLocale(db, row.user_id);

  const profilePath = username ? `/u/${encodeURIComponent(username)}` : `/account`;
  const profileUrl = `${baseUrl}${profilePath}`;

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

  const isOCA = !template.collection_symbol;

  const { error: pendingErr } = await db.from("credential_issuances").update({
    oc_request_payload: ocBody as Record<string, unknown>,
    network,
    error_message: null,
  }).eq("id", issuanceId);
  if (pendingErr) throw new Error(pendingErr.message);

  let ocResponseJson: unknown = null;
  let ocCredentialId: string | null = null;
  try {
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
      await db.from("credential_issuances").update({
        status: dup ? "minted" : "failed",
        oc_response: ocResponseJson as Record<string, unknown>,
        error_message: dup ? null : `HTTP ${res.status}: ${msg}`,
        retry_count: row.retry_count + 1,
        ...(dup
          ? {
            minted_at: awardedIso,
            oc_credential_id: ocCredentialId,
          }
          : {}),
      }).eq("id", issuanceId);
      if (dup) {
        await Promise.all([
          email
            ? sendMintEmail({
              to: email,
              scopeType: template.scope_type,
              isOCA,
              badgeName: template.name,
              profileUrl,
              credentialId: ocCredentialId,
              imageUrl: template.image_url,
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
    ocCredentialId =
      (parsed.credentialId && String(parsed.credentialId)) ||
      (parsed.id && String(parsed.id)) ||
      (parsed.credential_id && String(parsed.credential_id)) ||
      null;

    await db.from("credential_issuances").update({
      status: "minted",
      minted_at: awardedIso,
      oc_response: parsed,
      oc_credential_id: ocCredentialId,
      error_message: null,
      retry_count: row.retry_count,
    }).eq("id", issuanceId);

    await Promise.all([
      email
        ? sendMintEmail({
          to: email,
          scopeType: template.scope_type,
          isOCA,
          badgeName: template.name,
          profileUrl,
          credentialId: ocCredentialId,
          imageUrl: template.image_url,
          locale: emailLocale,
        })
        : Promise.resolve(),
      insertCredentialNotification(db, {
        userId: row.user_id,
        credentialName: template.name,
        scopeType: template.scope_type,
        imageUrl: template.image_url,
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
