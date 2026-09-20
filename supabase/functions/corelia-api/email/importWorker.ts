import type { SupabaseClient } from "../lib/supabase.ts";
import { contactColumnIndex, contactNameFromCsv, consentFromCsv, normalizeEmail, parseCsv, type ContactColumnMapping } from "./csv.ts";
import { normalizeEmailLocale } from "../lib/mail/locale.ts";

const CHUNK_SIZE = 250;

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function processNextImportChunk(db: SupabaseClient): Promise<{ processed: number; completed: boolean }> {
  const lease = crypto.randomUUID();
  const { data, error } = await db.rpc("email_claim_import_job", { p_lease_token: lease });
  if (error) throw error;
  const job = data?.[0];
  if (!job) return { processed: 0, completed: false };
  try {
    const { data: blob, error: downloadError } = await db.storage.from("email-imports").download(job.storage_path);
    if (downloadError || !blob) throw downloadError ?? new Error("import_download_failed");
    const rows = parseCsv(await blob.text());
    if (rows.length < 2) throw new Error("csv_has_no_data");
    const headers = rows[0]!.map((value) => value.trim());
    const mapping = (job.column_mapping ?? {}) as ContactColumnMapping;
    const emailIndex = contactColumnIndex(headers, "email", mapping);
    const localeIndex = contactColumnIndex(headers, "locale", mapping);
    const consentIndex = contactColumnIndex(headers, "marketing_consent", mapping);
    if (emailIndex < 0) throw new Error("csv_email_column_missing");

    const start = Math.max(1, Number(job.cursor_row ?? 0) + 1);
    const end = Math.min(rows.length, start + CHUNK_SIZE);
    const unique = new Map<string, { email: string; full_name: string | null; locale: "vi" | "en"; consent: boolean; row: number }>();
    const errors: string[] = [];
    let invalid = 0;
    let duplicate = 0;
    for (let index = start; index < end; index += 1) {
      const row = rows[index]!;
      const email = normalizeEmail(row[emailIndex] ?? "");
      if (!email) {
        invalid += 1;
        errors.push(`${index + 1},${csvCell(row[emailIndex] ?? "")},invalid_email`);
        continue;
      }
      if (unique.has(email)) { duplicate += 1; continue; }
      unique.set(email, {
        email,
        full_name: contactNameFromCsv(row, headers, mapping),
        locale: normalizeEmailLocale(localeIndex >= 0 ? row[localeIndex] : null),
        consent: consentIndex >= 0 && consentFromCsv(row[consentIndex] ?? ""),
        row: index + 1,
      });
    }
    const contactsInput = [...unique.values()];
    let imported = 0;
    if (contactsInput.length) {
      const now = new Date().toISOString();
      const emails = contactsInput.map((item) => item.email);
      const { data: existingContacts, error: existingError } = await db.from("email_contacts").select("id,email,user_id,full_name,locale,source_type").in("email", emails);
      if (existingError) throw existingError;
      const existingByEmail = new Map((existingContacts ?? []).map((contact) => [contact.email, contact]));
      const inserts = contactsInput.filter((item) => !existingByEmail.has(item.email)).map(({ email, full_name, locale }) => ({
        email, full_name, locale, source_type: job.source_type === "luma" ? "luma" : "csv",
        metadata: { source: job.source_type === "luma" ? "luma" : "csv" }, updated_at: now,
      }));
      if (inserts.length) {
        const { error: insertError } = await db.from("email_contacts").insert(inserts);
        if (insertError) throw insertError;
      }
      for (const item of contactsInput) {
        const existing = existingByEmail.get(item.email);
        if (!existing || existing.user_id) continue;
        const { error: updateError } = await db.from("email_contacts").update({
          full_name: item.full_name ?? existing.full_name,
          locale: localeIndex >= 0 ? item.locale : existing.locale,
          source_type: existing.source_type === "corelia" ? "corelia" : (job.source_type === "luma" ? "luma" : "csv"),
          updated_at: now,
        }).eq("id", existing.id).is("user_id", null);
        if (updateError) throw updateError;
      }
      const { data: contacts, error: contactsError } = await db.from("email_contacts").select("id,email").in("email", emails);
      if (contactsError) throw contactsError;
      const contactByEmail = new Map((contacts ?? []).map((contact) => [contact.email, contact.id]));
      const contactIds = [...contactByEmail.values()];
      const { data: existingMembers } = await db.from("email_list_members").select("contact_id").eq("list_id", job.list_id).in("contact_id", contactIds);
      const existingIds = new Set((existingMembers ?? []).map((member) => member.contact_id));
      duplicate += existingIds.size;
      imported = Math.max(0, contactsInput.length - existingIds.size);
      const { error: memberError } = await db.from("email_list_members").upsert(contactIds.map((contact_id) => ({ list_id: job.list_id, contact_id })), { onConflict: "list_id,contact_id", ignoreDuplicates: true });
      if (memberError) throw memberError;
      const consentItems = contactsInput.filter((item) => item.consent).map((item) => ({ ...item, contact_id: contactByEmail.get(item.email)! }));
      if (consentItems.length) {
        const { data: prior } = await db.from("email_contact_consents").select("contact_id,status").eq("topic", "marketing").in("contact_id", consentItems.map((item) => item.contact_id));
        const unsubscribed = new Set((prior ?? []).filter((item) => item.status === "unsubscribed").map((item) => item.contact_id));
        const consentRows = consentItems.filter((item) => !unsubscribed.has(item.contact_id)).map((item) => ({ contact_id: item.contact_id, topic: "marketing", status: "subscribed", source: job.source_type === "luma" ? "luma_csv_import" : "csv_import", evidence: { import_id: job.id, row: item.row }, changed_at: now }));
        if (consentRows.length) {
          const { error: consentError } = await db.from("email_contact_consents").upsert(consentRows, { onConflict: "contact_id,topic" });
          if (consentError) throw consentError;
        }
      }
    }

    let errorPath = job.error_report_path as string | null;
    if (errors.length) {
      errorPath ||= `${job.created_by}/${job.id}/errors.csv`;
      let previous = "row,email,error\n";
      const existing = await db.storage.from("email-imports").download(errorPath);
      if (existing.data) previous = await existing.data.text();
      await db.storage.from("email-imports").upload(errorPath, new Blob([`${previous.trimEnd()}\n${errors.join("\n")}\n`], { type: "text/csv" }), { upsert: true });
    }
    const completed = end >= rows.length;
    const { error: updateError } = await db.from("email_import_jobs").update({
      status: completed ? "completed" : "uploaded",
      cursor_row: end - 1,
      total_rows: rows.length - 1,
      imported_count: Number(job.imported_count ?? 0) + Math.max(0, imported),
      duplicate_count: Number(job.duplicate_count ?? 0) + duplicate,
      invalid_count: Number(job.invalid_count ?? 0) + invalid,
      error_report_path: errorPath,
      lease_token: null,
      lease_acquired_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("lease_token", lease);
    if (updateError) throw updateError;
    if (completed) await db.from("email_audit_logs").insert({ actor_id: job.created_by, action: "complete", entity_type: "email_import", entity_id: job.id, metadata: { total_rows: rows.length - 1 } });
    return { processed: end - start, completed };
  } catch (cause) {
    await db.from("email_import_jobs").update({ status: "failed", error_message: cause instanceof Error ? cause.message : String(cause), lease_token: null, lease_acquired_at: null, updated_at: new Date().toISOString() }).eq("id", job.id).eq("lease_token", lease);
    throw cause;
  }
}
