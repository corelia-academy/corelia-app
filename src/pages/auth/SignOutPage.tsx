import { useEffect, useRef } from "react";

import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { useAuth } from "@/stores/authStore";

/**
 * "Log out" target for the landing site's account menu: the session belongs to the app,
 * so the landing links here and the app signs out, then returns to the landing home.
 */
export default function SignOutPage() {
  const { signOut } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signOut().then(() => window.location.replace("/"));
  }, [signOut]);

  return <AuthGateLoading />;
}
