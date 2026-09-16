import { getUserRole, isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { normalizeEmail } from "./csv.ts";
import { isSafeEmailUrl, missingTemplateVariables, renderEmailDocument, renderTextTemplate, templateVariables } from "./template.ts";

const PURPOSES = new Set(["system", "learning", "event", "marketing"]);
const SYSTEM_TRIGGERS = new Set(["account_verified", "course_enrolled", "learning_inactive", "object_registration_approved", "course_completed"]);
const PAGE_SIZE = 50;

type AdminContext = { id: string; role: "admin" | "support_staff" };

async function requireEmailAdmin(req: Request, db: SupabaseClient): Promise<AdminContext> {
  const user = await verifyBearerUser(req, db);
  const role = await getUserRole(db, user.id);
  if (role !== "admin" && role !== "support_staff") throw new Error("forbidden:email_admin");
  return { id: user.id, role };
}

function requireFullAdmin(actor: AdminContext): void {
  if (actor.role !== "admin") throw new Error("forbidden:admin_only");
}

async function audit(db: SupabaseClient, actor: AdminContext, action: string, type: string, id?: string, metadata: Record<string, unknown> = {}) {
  const { error } = await db.from("email_audit_logs").insert({ actor_id: actor.id, action, entity_type: type, entity_id: id ?? null, metadata });
  if (error) console.error("[email-center] audit", error);
}

async function validateObject(db: SupabaseClient, type: string | null, id: string | null): Promise<boolean> {
  if (!type && !id) return true;
  if (!type || !id) return false;
  const table = type === "course" ? "courses" : type === "hackathon" ? "hackathons" : type === "program" ? "career_tracks" : "";
  if (!table) return false;
  const { data, error } = await db.from(table).select("id").eq("id", id).maybeSingle();
  return !error && Boolean(data);
}

function pageRange(raw: unknown): [number, number] {
  const page = Math.max(0, Math.floor(Number(raw) || 0));
  return [page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1];
}

async function dashboard(db: SupabaseClient): Promise<Response> {
  const [contacts, templates, campaigns, queued, imports, automations, senders, settings] = await Promise.all([
    db.from("email_contacts").select("id", { count: "exact", head: true }),
    db.from("email_templates").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("email_campaigns").select("id", { count: "exact", head: true }),
    db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).in("status", ["queued", "sending", "indeterminate"]),
    db.from("email_import_jobs").select("id,status,original_filename,imported_count,invalid_count,created_at").order("created_at", { ascending: false }).limit(5),
    db.from("email_automations").select("id,name,trigger_type,purpose,enabled,updated_at").order("updated_at", { ascending: false }),
    db.from("email_senders").select("*").order("purpose"),
    db.from("email_settings").select("*").eq("singleton", true).single(),
  ]);
  return json({
    counts: { contacts: contacts.count ?? 0, templates: templates.count ?? 0, campaigns: campaigns.count ?? 0, queued: queued.count ?? 0 },
    imports: imports.data ?? [], automations: automations.data ?? [], senders: senders.data ?? [], settings: settings.data,
  });
}

async function listRows(db: SupabaseClient, action: string, body: Record<string, unknown>): Promise<Response> {
  const [from, to] = pageRange(body.page);
  if (action === "contacts.list") {
    let query = db.from("email_contacts").select("*, email_contact_consents(topic,status,source,changed_at)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    const search = String(body.search ?? "").trim();
    if (search) query = query.or(`email.ilike.%${search.replace(/[%_,()]/g, "") }%,full_name.ilike.%${search.replace(/[%_,()]/g, "")}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    return json({ items: data ?? [], total: count ?? 0, page: Math.floor(from / PAGE_SIZE), page_size: PAGE_SIZE });
  }
  const table = action === "lists.list" ? "email_lists" : action === "templates.list" ? "email_templates" : "email_campaigns";
  const selection = action === "templates.list" ? "*, email_template_versions(*)" : action === "campaigns.list" ? "*, email_senders(display_name,from_email), email_templates:email_template_versions(subject,version,email_templates(name))" : "*";
  const { data, error, count } = await db.from(table).select(selection, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return json({ items: data ?? [], total: count ?? 0, page: Math.floor(from / PAGE_SIZE), page_size: PAGE_SIZE });
}

async function createImport(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const filename = String(body.filename ?? "contacts.csv").replace(/[^a-zA-Z0-9._-]/g, "_");
  const listName = String(body.list_name ?? filename.replace(/\.csv$/i, "")).trim();
  if (!listName) return json({ message: "invalid_input:list_name" }, 400);
  const { data: list, error: listError } = await db.from("email_lists").insert({ name: listName, source_type: "import", created_by: actor.id }).select("id").single();
  if (listError) throw listError;
  const importId = crypto.randomUUID();
  const path = `${actor.id}/${importId}/${filename}`;
  const { data: upload, error: uploadError } = await db.storage.from("email-imports").createSignedUploadUrl(path);
  if (uploadError) throw uploadError;
  const { error } = await db.from("email_import_jobs").insert({ id: importId, list_id: list.id, storage_path: path, original_filename: filename, column_mapping: body.column_mapping ?? {}, created_by: actor.id });
  if (error) throw error;
  await audit(db, actor, "create", "email_import", importId);
  return json({ id: importId, list_id: list.id, path, token: upload.token });
}

async function processImport(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? "");
  const { data: job, error: jobError } = await db.from("email_import_jobs").select("*").eq("id", id).single();
  if (jobError || !job) return json({ message: "import_not_found" }, 404);
  const { error: queueError } = await db.from("email_import_jobs").update({ status: "uploaded", column_mapping: body.column_mapping ?? job.column_mapping ?? {}, error_message: null, updated_at: new Date().toISOString() }).eq("id", id);
  if (queueError) throw queueError;
  await audit(db, actor, "queue", "email_import", id);
  return json({ ok: true, id, status: "uploaded" });
}

async function saveTemplate(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const purpose = String(body.purpose ?? "");
  if (!PURPOSES.has(purpose)) return json({ message: "invalid_input:purpose" }, 400);
  if (purpose === "system") requireFullAdmin(actor);
  const templateId = String(body.id ?? "") || crypto.randomUUID();
  const subject = String(body.subject ?? "").trim();
  const bodyText = String(body.body_text ?? "").trim();
  if (!subject || !bodyText) return json({ message: "missing_fields:subject,body_text" }, 400);
  const ctaUrl = String(body.cta_url ?? "").trim() || null;
  const variables = templateVariables(subject, String(body.preheader ?? ""), bodyText, String(body.cta_label ?? ""), ctaUrl);
  const urlValues = Object.fromEntries(variables.map((key) => [key, key.endsWith("url") ? "https://example.com" : "value"]));
  if (ctaUrl && !isSafeEmailUrl(renderTextTemplate(ctaUrl, urlValues))) return json({ message: "unsafe_cta_url" }, 400);
  const imageUrl = String(body.image_url ?? "").trim() || null;
  if (imageUrl && !isSafeEmailUrl(renderTextTemplate(imageUrl, urlValues))) return json({ message: "unsafe_image_url" }, 400);
  const { data: existing } = await db.from("email_templates").select("id").eq("id", templateId).maybeSingle();
  if (existing) await db.from("email_templates").update({ name: String(body.name ?? "").trim(), purpose, description: String(body.description ?? "").trim() || null, updated_at: new Date().toISOString() }).eq("id", templateId);
  else {
    const { error } = await db.from("email_templates").insert({ id: templateId, name: String(body.name ?? "").trim(), purpose, description: String(body.description ?? "").trim() || null, created_by: actor.id });
    if (error) throw error;
  }
  const { data: versions } = await db.from("email_template_versions").select("version,status").eq("template_id", templateId).order("version", { ascending: false });
  const draft = versions?.find((v) => v.status === "draft");
  const payload = { subject, preheader: String(body.preheader ?? ""), body_text: bodyText, cta_label: String(body.cta_label ?? "").trim() || null, cta_url: ctaUrl, image_url: imageUrl, variables, created_by: actor.id };
  let versionId: string;
  if (draft) {
    const { data, error } = await db.from("email_template_versions").update(payload).eq("template_id", templateId).eq("version", draft.version).select("id").single();
    if (error) throw error; versionId = data.id;
  } else {
    const version = Number(versions?.[0]?.version ?? 0) + 1;
    const { data, error } = await db.from("email_template_versions").insert({ template_id: templateId, version, ...payload }).select("id").single();
    if (error) throw error; versionId = data.id;
  }
  await audit(db, actor, "save", "email_template", templateId);
  return json({ ok: true, id: templateId, version_id: versionId, variables });
}

async function publishTemplate(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.version_id ?? "");
  const { data: version } = await db.from("email_template_versions").select("id,template_id,email_templates(purpose)").eq("id", id).single();
  const purpose = String((version?.email_templates as unknown as { purpose?: string } | null)?.purpose ?? "");
  if (!version) return json({ message: "template_version_not_found" }, 404);
  if (purpose === "system") requireFullAdmin(actor);
  await db.from("email_template_versions").update({ status: "archived" }).eq("template_id", version.template_id).eq("status", "published");
  const { error } = await db.from("email_template_versions").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id).eq("status", "draft");
  if (error) throw error;
  await audit(db, actor, "publish", "email_template_version", id);
  return json({ ok: true });
}

async function saveCampaign(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const purpose = String(body.purpose ?? "");
  if (!PURPOSES.has(purpose)) return json({ message: "invalid_input:purpose" }, 400);
  if (purpose === "system") requireFullAdmin(actor);
  const objectType = String(body.object_type ?? "").trim() || null;
  const objectId = String(body.object_id ?? "").trim() || null;
  if (!await validateObject(db, objectType, objectId)) return json({ message: "invalid_object_context" }, 400);
  const { data: sender } = await db.from("email_senders").select("id,domain_status,purpose,display_name,from_email,reply_to").eq("id", String(body.sender_id ?? "")).eq("active", true).maybeSingle();
  if (!sender || sender.purpose !== purpose) return json({ message: "invalid_sender" }, 400);
  const { data: version } = await db.from("email_template_versions").select("id,subject,preheader,body_text,cta_label,cta_url,image_url,variables,email_templates(purpose)").eq("id", String(body.template_version_id ?? "")).eq("status", "published").maybeSingle();
  if (!version) return json({ message: "published_template_required" }, 400);
  const templatePurpose = String((version.email_templates as unknown as { purpose?: string } | null)?.purpose ?? "");
  if (templatePurpose !== purpose) return json({ message: "template_purpose_mismatch" }, 400);
  const values = (body.preview_values ?? {}) as Record<string, unknown>;
  const availableValues = { name: "Recipient", email: "recipient@example.com", locale: "vi", ...values };
  const missing = missingTemplateVariables(version.variables ?? [], availableValues);
  if (missing.length) return json({ message: "missing_template_variables", missing }, 400);
  const genericValues = Object.fromEntries((version.variables ?? []).map((key: string) => [key, values[key] ?? `{{${key}}}`]));
  const rendered = renderEmailDocument({ subject: version.subject, preheader: version.preheader, bodyText: version.body_text, ctaLabel: version.cta_label, ctaUrl: version.cta_url, imageUrl: version.image_url, purpose, values: genericValues });
  const id = crypto.randomUUID();
  const { error } = await db.from("email_campaigns").insert({ id, name: String(body.name ?? "").trim(), purpose, object_type: objectType, object_id: objectId, list_id: String(body.list_id ?? ""), sender_id: sender.id, template_version_id: version.id, frozen_subject: rendered.subject, frozen_html: rendered.html, frozen_from: `${sender.display_name} <${sender.from_email}>`, frozen_reply_to: sender.reply_to, frozen_values: values, created_by: actor.id });
  if (error) throw error;
  await audit(db, actor, "create", "email_campaign", id, { missing_preview_variables: missing });
  return json({ ok: true, id });
}

async function prepareCampaign(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? "");
  const { data, error } = await db.rpc("email_prepare_campaign", { p_campaign_id: id });
  if (error?.message.includes("campaign_not_draft")) return json({ message: "campaign_not_draft" }, 409);
  if (error?.message.includes("campaign_operational_limit_exceeded")) return json({ message: "campaign_operational_limit_exceeded" }, 409);
  if (error) throw error;
  const summary = (data ?? {}) as Record<string, unknown>;
  await audit(db, actor, "prepare", "email_campaign", id, summary);
  return json({ ok: true, ...summary });
}

async function controlCampaign(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? "");
  const command = String(body.command ?? "");
  const next: Record<string, string> = { start: "scheduled", pause: "paused", resume: "scheduled", cancel: "cancelled" };
  if (!next[command]) return json({ message: "invalid_campaign_command" }, 400);
  const { data: current } = await db.from("email_campaigns").select("status,sender_id,email_senders(domain_status,active)").eq("id", id).maybeSingle();
  if (!current) return json({ message: "campaign_not_found" }, 404);
  const allowed: Record<string, string[]> = { start: ["ready"], pause: ["scheduled", "running"], resume: ["paused"], cancel: ["ready", "scheduled", "running", "paused"] };
  if (!allowed[command]!.includes(current.status)) return json({ message: "invalid_campaign_transition" }, 409);
  const sender = current.email_senders as unknown as { domain_status?: string; active?: boolean } | null;
  if ((command === "start" || command === "resume") && (!sender?.active || sender.domain_status !== "verified")) return json({ message: "sender_not_verified" }, 409);
  const patch: Record<string, unknown> = { status: next[command], updated_at: new Date().toISOString() };
  if (command === "start") {
    const scheduledAt = body.scheduled_at ? new Date(String(body.scheduled_at)) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) return json({ message: "invalid_scheduled_at" }, 400);
    patch.scheduled_at = scheduledAt.toISOString();
  }
  const { data, error } = await db.from("email_campaigns").update(patch).eq("id", id).eq("status", current.status).select("id,status").single();
  if (error) throw error;
  if (command === "cancel") await db.from("email_campaign_recipients").update({ status: "cancelled", lease_token: null, lease_acquired_at: null, updated_at: new Date().toISOString() }).eq("campaign_id", id).in("status", ["queued", "sending"]).is("first_dispatched_at", null);
  await audit(db, actor, command, "email_campaign", id);
  return json({ ok: true, campaign: data });
}

async function testEmail(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const to = normalizeEmail(String(body.to ?? ""));
  if (!to) return json({ message: "invalid_recipient" }, 400);
  const { data: version } = await db.from("email_template_versions").select("*,email_templates(purpose)").eq("id", String(body.template_version_id ?? "")).single();
  const values = (body.values ?? {}) as Record<string, unknown>;
  const missing = missingTemplateVariables(version.variables ?? [], values);
  if (missing.length) return json({ message: "missing_template_variables", missing }, 400);
  const purpose = String((version.email_templates as unknown as { purpose?: string } | null)?.purpose ?? "system");
  if (purpose === "system") requireFullAdmin(actor);
  const { data: sender } = await db.from("email_senders").select("display_name,from_email,reply_to,domain_status,active").eq("purpose", purpose).eq("is_default", true).maybeSingle();
  if (!sender?.active || sender.domain_status !== "verified") return json({ message: "sender_not_verified" }, 409);
  const rendered = renderEmailDocument({ subject: version.subject, preheader: version.preheader, bodyText: version.body_text, ctaLabel: version.cta_label, ctaUrl: version.cta_url, imageUrl: version.image_url, purpose, values });
  const result = await sendTransactionalEmailViaResend({ db, mailType: "email_center_test", to: [to], subject: `[TEST] ${rendered.subject}`, html: rendered.html, from: `${sender.display_name} <${sender.from_email}>`, replyTo: sender.reply_to, idempotencyKey: `email-center-test/${crypto.randomUUID()}` });
  await audit(db, actor, "test_send", "email_template_version", version.id, { to });
  return json({ ok: true, result });
}

async function saveAutomation(db: SupabaseClient, actor: AdminContext, body: Record<string, unknown>): Promise<Response> {
  const trigger = String(body.trigger_type ?? "");
  const purpose = String(body.purpose ?? "");
  if (SYSTEM_TRIGGERS.has(trigger)) requireFullAdmin(actor);
  if (trigger !== "marketing_consent" && !SYSTEM_TRIGGERS.has(trigger)) return json({ message: "invalid_trigger" }, 400);
  if (!PURPOSES.has(purpose)) return json({ message: "invalid_purpose" }, 400);
  if (actor.role !== "admin" && purpose !== "marketing") return json({ message: "forbidden:marketing_automation_only" }, 403);
  const objectType = String(body.object_type ?? "").trim() || null;
  const objectId = String(body.object_id ?? "").trim() || null;
  if (!await validateObject(db, objectType, objectId)) return json({ message: "invalid_object_context" }, 400);
  const enabled = Boolean(body.enabled);
  const id = String(body.id ?? "") || crypto.randomUUID();
  const stepsInput = Array.isArray(body.steps) ? body.steps as Array<Record<string, unknown>> : [];
  for (const step of stepsInput) {
    const [{ data: sender }, { data: version }] = await Promise.all([
      db.from("email_senders").select("purpose,active,domain_status").eq("id", String(step.sender_id ?? "")).maybeSingle(),
      db.from("email_template_versions").select("status,email_templates(purpose)").eq("id", String(step.template_version_id ?? "")).maybeSingle(),
    ]);
    const templatePurpose = String((version?.email_templates as unknown as { purpose?: string } | null)?.purpose ?? "");
    if (!sender || sender.purpose !== purpose || !version || version.status !== "published" || templatePurpose !== purpose) return json({ message: "invalid_automation_step" }, 400);
    if (enabled && (!sender.active || sender.domain_status !== "verified")) return json({ message: "sender_not_verified" }, 409);
  }
  const payload = { id, name: String(body.name ?? "").trim(), trigger_type: trigger, purpose, object_type: objectType, object_id: objectId, enabled, stop_conditions: body.stop_conditions ?? [], created_by: actor.id, updated_at: new Date().toISOString() };
  const { error } = await db.from("email_automations").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  if (Array.isArray(body.steps)) {
    await db.from("email_automation_steps").delete().eq("automation_id", id);
    const steps = stepsInput.map((step, position) => ({ automation_id: id, position, delay_minutes: Math.max(0, Number(step.delay_minutes ?? 0)), template_version_id: String(step.template_version_id ?? ""), sender_id: String(step.sender_id ?? "") }));
    if (steps.length) { const result = await db.from("email_automation_steps").insert(steps); if (result.error) throw result.error; }
  }
  await audit(db, actor, enabled ? "enable" : "save", "email_automation", id);
  return json({ ok: true, id });
}

export async function handleEmailAdmin(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const actor = await requireEmailAdmin(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "dashboard");
    if (action === "dashboard") return dashboard(db);
    if (["contacts.list", "lists.list", "templates.list", "campaigns.list"].includes(action)) return listRows(db, action, body);
    if (action === "imports.create") return createImport(db, actor, body);
    if (action === "imports.process") return processImport(db, actor, body);
    if (action === "imports.report") {
      const { data: job } = await db.from("email_import_jobs").select("error_report_path").eq("id", String(body.id ?? "")).maybeSingle();
      if (!job?.error_report_path) return json({ message: "import_report_not_found" }, 404);
      const { data, error } = await db.storage.from("email-imports").createSignedUrl(job.error_report_path, 600);
      if (error) throw error;
      return json({ url: data.signedUrl });
    }
    if (action === "templates.save") return saveTemplate(db, actor, body);
    if (action === "templates.publish") return publishTemplate(db, actor, body);
    if (action === "templates.test") return testEmail(db, actor, body);
    if (action === "campaigns.create") return saveCampaign(db, actor, body);
    if (action === "campaigns.prepare") return prepareCampaign(db, actor, body);
    if (action === "campaigns.control") return controlCampaign(db, actor, body);
    if (action === "campaigns.reconcile") {
      requireFullAdmin(actor);
      const outcome = String(body.outcome ?? "");
      if (!new Set(["accepted", "failed"]).has(outcome)) return json({ message: "invalid_reconcile_outcome" }, 400);
      const recipientId = String(body.recipient_id ?? "");
      const { data: recipient, error } = await db.from("email_campaign_recipients").update({ status: outcome, provider_message_id: String(body.provider_message_id ?? "").trim() || null, last_error: outcome === "failed" ? String(body.reason ?? "manual_reconciliation") : null, updated_at: new Date().toISOString() }).eq("id", recipientId).eq("status", "indeterminate").select("campaign_id").maybeSingle();
      if (error) throw error;
      if (!recipient) return json({ message: "recipient_not_indeterminate" }, 409);
      await db.rpc("email_refresh_campaign_counts", { p_campaign_id: recipient.campaign_id });
      await audit(db, actor, "reconcile", "email_campaign_recipient", recipientId, { outcome, reason: body.reason ?? null });
      return json({ ok: true });
    }
    if (action === "automations.save") return saveAutomation(db, actor, body);
    if (action === "automations.toggle") {
      const id = String(body.id ?? "");
      const enabled = Boolean(body.enabled);
      const { data: automation } = await db.from("email_automations").select("id,purpose,trigger_type,email_automation_steps(email_senders(active,domain_status),email_template_versions(status))").eq("id", id).maybeSingle();
      if (!automation) return json({ message: "automation_not_found" }, 404);
      if (actor.role !== "admin" && automation.purpose !== "marketing") return json({ message: "forbidden:marketing_automation_only" }, 403);
      if (SYSTEM_TRIGGERS.has(automation.trigger_type)) requireFullAdmin(actor);
      const steps = automation.email_automation_steps as unknown as Array<{ email_senders?: { active?: boolean; domain_status?: string }; email_template_versions?: { status?: string } }>;
      if (enabled && (!steps?.length || steps.some((step) => !step.email_senders?.active || step.email_senders.domain_status !== "verified" || step.email_template_versions?.status !== "published"))) return json({ message: "automation_not_ready" }, 409);
      const { error } = await db.from("email_automations").update({ enabled, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await audit(db, actor, enabled ? "enable" : "disable", "email_automation", id);
      return json({ ok: true });
    }
    if (action === "senders.save") {
      requireFullAdmin(actor);
      const purpose = String(body.purpose ?? "");
      const fromEmail = normalizeEmail(String(body.from_email ?? ""));
      const replyTo = normalizeEmail(String(body.reply_to ?? ""));
      const domain = String(body.domain ?? "").trim().toLowerCase();
      if (!PURPOSES.has(purpose) || !fromEmail || !replyTo || fromEmail.split("@")[1] !== domain) return json({ message: "invalid_sender" }, 400);
      const payload = { purpose, display_name: String(body.display_name ?? "").trim(), from_email: fromEmail, reply_to: replyTo, domain, domain_status: String(body.domain_status ?? "pending"), is_default: Boolean(body.is_default), active: body.active !== false, created_by: actor.id, updated_at: new Date().toISOString() };
      if (payload.is_default) await db.from("email_senders").update({ is_default: false }).eq("purpose", purpose);
      const { data, error } = await db.from("email_senders").upsert({ id: String(body.id ?? "") || crypto.randomUUID(), ...payload }, { onConflict: "id" }).select("id").single();
      if (error) throw error;
      await audit(db, actor, "save", "email_sender", data.id);
      return json({ ok: true, id: data.id });
    }
    if (action === "settings.save") {
      requireFullAdmin(actor);
      const allowed = ["sending_enabled", "max_recipients_per_campaign", "worker_batch_size", "requests_per_second", "bounce_pause_percent", "complaint_pause_percent"];
      const patch = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
      const { error } = await db.from("email_settings").update({ ...patch, updated_by: actor.id, updated_at: new Date().toISOString() }).eq("singleton", true);
      if (error) throw error;
      await audit(db, actor, "save", "email_settings");
      return json({ ok: true });
    }
    return json({ message: "unknown_email_action" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAuthFailure(message)) return json({ message: "unauthenticated" }, 401);
    if (message.startsWith("forbidden:")) return json({ message }, 403);
    console.error("[email-center] admin", error);
    return json({ message: "email_operation_failed" }, 500);
  }
}

export async function handleEmailUnsubscribe(req: Request, db: SupabaseClient): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const recipientId = String(body.token ?? new URL(req.url).searchParams.get("token") ?? "");
  const { data: recipient } = await db.from("email_campaign_recipients").select("id,contact_id,campaign_id,email_campaigns(purpose)").eq("id", recipientId).maybeSingle();
  const { data: enrollment } = recipient ? { data: null } : await db.from("email_automation_enrollments").select("id,contact_id,email_automations(purpose)").eq("id", recipientId).maybeSingle();
  if (!recipient && !enrollment) return json({ message: "invalid_unsubscribe_token" }, 404);
  const purpose = recipient
    ? String((recipient.email_campaigns as unknown as { purpose?: string } | null)?.purpose ?? "")
    : String((enrollment?.email_automations as unknown as { purpose?: string } | null)?.purpose ?? "");
  if (purpose !== "marketing") return json({ message: "unsubscribe_not_available" }, 400);
  const contactId = recipient?.contact_id ?? enrollment!.contact_id;
  await db.from("email_contact_consents").upsert({ contact_id: contactId, topic: "marketing", status: "unsubscribed", source: "email_link", changed_at: new Date().toISOString() });
  if (recipient) await db.from("email_campaign_recipients").update({ status: "unsubscribed", updated_at: new Date().toISOString() }).eq("id", recipient.id);
  await db.from("email_campaign_recipients").update({ status: "unsubscribed", updated_at: new Date().toISOString() }).eq("contact_id", contactId).eq("status", "queued");
  await db.from("email_automation_enrollments").update({ status: "stopped", updated_at: new Date().toISOString() }).eq("contact_id", contactId).eq("status", "active");
  if (recipient) await db.rpc("email_refresh_campaign_counts", { p_campaign_id: recipient.campaign_id });
  return json({ ok: true, settings_url: `${resolveAppUrl()}/account/settings` });
}
