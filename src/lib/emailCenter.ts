import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import type { ContactCsvMapping } from "@/lib/contactCsv";

export type EmailPurpose = "system" | "learning" | "event" | "marketing";
export type EmailDashboard = {
  counts: { contacts: number; templates: number; campaigns: number; queued: number };
  imports: Array<Record<string, unknown>>;
  automations: Array<Record<string, unknown>>;
  senders: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
};
export type Paginated<T = Record<string, unknown>> = { items: T[]; total: number; page: number; page_size: number };

export function emailAdmin<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return callCoreliaApi<T>("email.admin", { action, ...payload });
}

export type ContactCsvImportOptions = {
  listName: string;
  listId?: string;
  sourceType: "csv" | "luma";
  columnMapping: ContactCsvMapping;
};

export async function uploadContactCsv(file: File, options: ContactCsvImportOptions | string): Promise<Record<string, unknown>> {
  const normalized: ContactCsvImportOptions = typeof options === "string"
    ? { listName: options, sourceType: "csv", columnMapping: {} }
    : options;
  const job = await emailAdmin<{ id: string; path: string; token: string }>("imports.create", {
    filename: file.name,
    list_name: normalized.listName,
    list_id: normalized.listId,
    source_type: normalized.sourceType,
    column_mapping: normalized.columnMapping,
  });
  const { error } = await supabase.storage.from("email-imports").uploadToSignedUrl(job.path, job.token, file, { contentType: file.type || "text/csv" });
  if (error) throw error;
  return emailAdmin("imports.process", { id: job.id, column_mapping: normalized.columnMapping });
}
