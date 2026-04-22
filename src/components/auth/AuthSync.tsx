import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentProfile } from "@/lib/profile";
import { useAuthStore } from "@/stores/authStore";

/**
 * Đồng bộ session + profile từ Firebase vào auth store.
 * Mount 1 lần ở gốc app (thay AuthProvider).
 */
export function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setAuthInitialized = useAuthStore((s) => s.setAuthInitialized);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      setUser(user);
      setAuthInitialized(true);

      if (user) {
        setLoading(true);
        try {
          const p = await getCurrentProfile();
          if (mounted) setProfile(p);
        } catch (error) {
          console.error("Failed to load profile:", error);
          if (mounted) setProfile(null);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setUser, setProfile, setLoading, setAuthInitialized]);

  return null;
}
