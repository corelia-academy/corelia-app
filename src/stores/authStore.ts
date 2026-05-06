import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/profile";
import type { Profile, UserRole } from "@/types/database";
import { hasRole as checkRole } from "@/types/database";

/** Fallback nếu `signOut()` lỗi — xóa session Supabase khỏi localStorage (sb-*-auth-token). */
function clearSupabaseAuthFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("sb-") && k.includes("auth-token")) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

interface AuthStore {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authInitialized: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthInitialized: (authInitialized: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      loading: true,
      authInitialized: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      setAuthInitialized: (authInitialized) => set({ authInitialized }),

      signOut: async () => {
        const signOutDeadlineMs = 12_000;
        try {
          const raced = await Promise.race([
            supabase.auth.signOut(),
            new Promise<"timeout">((resolve) => {
              setTimeout(() => resolve("timeout"), signOutDeadlineMs);
            }),
          ]);
          if (raced === "timeout") {
            console.warn("[authStore] signOut timed out; clearing local Supabase session keys.");
            clearSupabaseAuthFromLocalStorage();
          } else if (raced && typeof raced === "object" && "error" in raced && raced.error) {
            console.error("[authStore] signOut:", raced.error.message);
            clearSupabaseAuthFromLocalStorage();
          }
        } catch (e) {
          console.error("[authStore] signOut:", e);
          clearSupabaseAuthFromLocalStorage();
        } finally {
          try {
            set({ user: null, profile: null, loading: false, authInitialized: true });
          } catch (e2) {
            console.error("[authStore] signOut clear state:", e2);
          }
        }
      },

      refreshProfile: async () => {
        try {
          const profile = await getCurrentProfile();
          set({ profile });
        } catch (err) {
          console.error("[authStore] refreshProfile failed:", err);
        }
      },
    }),
    {
      name: "corelia-auth",
      // v2: stop persisting `profile` to avoid mismatch with non-persisted `user`.
      // We rely on Supabase session persistence + `AuthSync` to load profile.
      version: 2,
      migrate: () => ({}),
      partialize: () => ({}),
    },
  ),
);

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const authInitialized = useAuthStore((s) => s.authInitialized);
  const signOut = useAuthStore((s) => s.signOut);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const setAuthInitialized = useAuthStore((s) => s.setAuthInitialized);

  const role = profile?.role;
  const isAuthenticated = !!user;
  const hasRole = (allowed: readonly UserRole[]) =>
    role ? checkRole(role, allowed) : false;

  return {
    user,
    profile,
    loading,
    authInitialized,
    signOut,
    refreshProfile,
    setAuthInitialized,
    isAuthenticated,
    role,
    hasRole,
  };
}
