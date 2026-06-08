import { supabase } from "@/lib/supabase";

/** Read a single value from public.system_settings. Returns null if unset.
 *  Admin/support only (RLS system_settings_staff_all). */
export async function getSystemSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value != null ? String(data.value) : null;
}

/** Upsert a single key into public.system_settings.
 *  Admin/support only (RLS system_settings_staff_all). */
export async function setSystemSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
