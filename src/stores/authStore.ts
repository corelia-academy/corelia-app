import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

import { currentProfileQueryOptions } from "@/features/auth/profileQueries";
import { clearPrivateQueryCache, queryClient } from "@/lib/queryClient";
import { signOutFromSupabase } from "@/lib/auth";
import type { UserRole } from "@/types/database";
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

export type AuthStatus = "booting" | "anonymous" | "authenticated" | "recovery";

interface AuthStore {
  user: User | null;
  status: AuthStatus;
  /** True when the current session was established via a password-recovery email link. */
  isPasswordRecovery: boolean;
  setAuthState: (user: User | null, status: AuthStatus) => void;
  setPasswordRecovery: (value: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  status: "booting",
  isPasswordRecovery: false,

  setAuthState: (user, status) =>
    set({ user, status, isPasswordRecovery: status === "recovery" }),
  setPasswordRecovery: (value) =>
    set((state) => ({
      isPasswordRecovery: value,
      status: value
        ? "recovery"
        : state.user
          ? "authenticated"
          : state.status === "booting"
            ? "booting"
            : "anonymous",
    })),

  signOut: async () => {
    const previousUserId = get().user?.id;
    const signOutDeadlineMs = 12_000;
    try {
      const raced = await Promise.race([
        signOutFromSupabase(),
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
        await clearPrivateQueryCache(previousUserId);
      } catch (e2) {
        console.error("[authStore] signOut clear state:", e2);
      } finally {
        set({ user: null, status: "anonymous", isPasswordRecovery: false });
      }
    }
  },
}));

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const signOut = useAuthStore((s) => s.signOut);
  const profileQuery = useQuery(currentProfileQueryOptions(user));
  const profile = user ? (profileQuery.data ?? null) : null;
  const profileLoading = user != null && profileQuery.isPending;
  const authInitialized = status !== "booting";

  const refreshProfile = useCallback(
    async (targetUser?: User | null) => {
      const target = targetUser ?? user;
      if (!target) return;
      await queryClient.fetchQuery({
        ...currentProfileQueryOptions(target),
        staleTime: 0,
      });
    },
    [user],
  );

  const role = profile?.role;
  const isAuthenticated = status === "authenticated" || status === "recovery";
  const hasRole = (allowed: readonly UserRole[]) =>
    role ? checkRole(role, allowed) : false;
  return {
    user,
    status,
    profile,
    profileLoading,
    profileError: profileQuery.error,
    /** @deprecated Prefer `profileLoading` — same value (profile fetch gate, not session init). */
    loading: profileLoading,
    authInitialized,
    signOut,
    refreshProfile,
    isAuthenticated,
    role,
    hasRole,
  };
}
