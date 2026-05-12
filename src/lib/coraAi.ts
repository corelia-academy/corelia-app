import { supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";

export function coraAiFunctionUrl(): string {
  const explicit = import.meta.env.VITE_CORA_AI_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/ai-tutor`;
}

export async function invokeCoraAi(body: Record<string, unknown>): Promise<Response> {
  const url = coraAiFunctionUrl();
  if (!url) throw new Error("Missing Supabase functions URL");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Bạn cần đăng nhập để dùng Cora AI.");

  return fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(token),
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
}
