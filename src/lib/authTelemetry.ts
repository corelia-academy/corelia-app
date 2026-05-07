import type { SupabaseClient } from "@supabase/supabase-js";

let telemetryInstalled = false;

function getOrCreateCorrelationId(): string {
  if (typeof window !== "undefined") {
    const w = window as Window & { __CORELIA_AUTH_CID__?: string };
    if (!w.__CORELIA_AUTH_CID__) {
      w.__CORELIA_AUTH_CID__ =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `cid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    return w.__CORELIA_AUTH_CID__;
  }
  return `cid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Dev-only: subscribe once to auth changes for local debugging (console). */
export function installAuthDebugTelemetry(supabase: SupabaseClient): void {
  if (!import.meta.env.DEV || telemetryInstalled) return;
  telemetryInstalled = true;

  const correlationId = getOrCreateCorrelationId();

  console.info("[auth-debug]", {
    phase: "boot",
    correlationId,
    version: import.meta.env.VITE_APP_VERSION,
  });

  supabase.auth.onAuthStateChange((event, session) => {
    console.info("[auth-debug]", {
      phase: "auth_state_change",
      correlationId,
      event,
      userId: session?.user?.id ?? null,
      ts: Date.now(),
    });
  });
}
