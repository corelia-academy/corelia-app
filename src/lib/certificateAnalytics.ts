import { supabase } from "@/lib/supabase";

export type CertificateAnalyticsFilters = {
  courseId: string;
  from: string;
  to: string;
  network: "" | "staging" | "mainnet";
};

export type CertificateAnalyticsRow = {
  user_id: string;
  course_id: string;
  course_title: string;
  learner_name: string;
  learner_email: string | null;
  completed_at: string | null;
  certificate_id: string | null;
  code: string | null;
  issued_at: string | null;
  revoked_at: string | null;
  issuance_id: string | null;
  network: string | null;
  oc_status: string | null;
  oc_credential_id: string | null;
  minted_at: string | null;
  error_message: string | null;
  core_email: string | null;
  oc_email: string | null;
  core_notification: boolean;
  oc_notification: boolean;
};

export type CertificateAnalyticsResult = {
  total: number;
  summary: {
    completed: number;
    corelia_issued: number;
    corelia_revoked: number;
    oca_minted: number;
    oca_unresolved: number;
    oca_pending: number;
    oca_failed: number;
    unique_learners: number;
  };
  mint_attempts_logged: number;
  courses: Array<{ id: string; title: string }>;
  rows: CertificateAnalyticsRow[];
};

export async function getCertificateAnalytics(
  filters: CertificateAnalyticsFilters,
  offset = 0,
  limit = 25,
): Promise<CertificateAnalyticsResult> {
  const { data, error } = await supabase.rpc("admin_certificate_analytics", {
    p_course: filters.courseId || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_network: filters.network || null,
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw error;
  return data as CertificateAnalyticsResult;
}

export function certificateAnalyticsCsv(rows: CertificateAnalyticsRow[]): string {
  const columns: Array<keyof CertificateAnalyticsRow> = [
    "course_id", "course_title", "user_id", "learner_name", "learner_email",
    "completed_at", "code", "issued_at", "revoked_at", "network", "oc_status",
    "oc_credential_id", "minted_at", "core_email", "core_notification",
    "oc_email", "oc_notification", "error_message",
  ];
  const escape = (value: unknown) => {
    const raw = String(value ?? "");
    const text = /^[\t\r\n ]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [columns.join(","), ...rows.map(row => columns.map(key => escape(row[key])).join(","))].join("\r\n");
}
