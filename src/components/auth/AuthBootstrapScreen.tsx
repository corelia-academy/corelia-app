import { AppLoadingScreen } from "@/components/loading/AppLoadingScreen";

/** Neutral first paint while Supabase restores the session. Never renders guest/auth UI prematurely. */
export function AuthBootstrapScreen() {
  return <AppLoadingScreen />;
}
