import { supabase } from "@/lib/supabase";

export type PendingCredentialRow = {
  id: string;
  email: string;
  template_id: string;
  network: string;
  granted_reason: string | null;
  created_at: string;
  template_name?: string;
  template_image_url?: string;
};

export async function listPendingCredentialsForAdmin(): Promise<PendingCredentialRow[]> {
  const { data, error } = await supabase
    .from("pending_credential_issuances")
    .select(`
      id,
      email,
      template_id,
      network,
      granted_reason,
      created_at,
      credential_templates (
        name,
        image_url
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const tpl = row.credential_templates as { name?: string; image_url?: string } | null;
    return {
      id: String(row.id),
      email: String(row.email),
      template_id: String(row.template_id),
      network: String(row.network),
      granted_reason: row.granted_reason ? String(row.granted_reason) : null,
      created_at: String(row.created_at),
      template_name: tpl?.name ? String(tpl.name) : undefined,
      template_image_url: tpl?.image_url ? String(tpl.image_url) : undefined,
    };
  });
}

export async function revokePendingCredential(id: string): Promise<void> {
  const { error } = await supabase
    .from("pending_credential_issuances")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
