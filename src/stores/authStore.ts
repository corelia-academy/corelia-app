import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getCurrentProfile, getProfileForUser } from "@/lib/profile";
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
  /** True while the signed-in user's profile row is being fetched (not session bootstrap). */
  profileLoading: boolean;
  authInitialized: boolean;
  /** True when the current session was established via a password-recovery email link. */
  isPasswordRecovery: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setProfileLoading: (profileLoading: boolean) => void;
  setAuthInitialized: (authInitialized: boolean) => void;
  setPasswordRecovery: (value: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: (user?: User | null) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      profileLoading: false,
      authInitialized: false,
      isPasswordRecovery: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setProfileLoading: (profileLoading) => set({ profileLoading }),
      setAuthInitialized: (authInitialized) => set({ authInitialized }),
      setPasswordRecovery: (value) => set({ isPasswordRecovery: value }),

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
            set({
              user: null,
              profile: null,
              profileLoading: false,
              authInitialized: true,
            });
          } catch (e2) {
            console.error("[authStore] signOut clear state:", e2);
          }
        }
      },

      refreshProfile: async (user?: User | null) => {
        try {
          const profile = user
            ? await getProfileForUser(user)
            : await getCurrentProfile();
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
  const profileLoading = useAuthStore((s) => s.profileLoading);
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
    profileLoading,
    /** @deprecated Prefer `profileLoading` — same value (profile fetch gate, not session init). */
    loading: profileLoading,
    authInitialized,
    signOut,
    refreshProfile,
    setAuthInitialized,
    isAuthenticated,
    role,
    hasRole,
  };
}
