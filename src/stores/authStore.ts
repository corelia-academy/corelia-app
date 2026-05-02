import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentProfile } from "@/lib/profile";
import type { Profile, UserRole } from "@/types/database";
import { hasRole as checkRole } from "@/types/database";

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
        await auth.signOut();
        // Không reset authInitialized khi signOut; nếu không /login sẽ kẹt loader
        // cho tới khi onAuthStateChanged chạy lại.
        set({ user: null, profile: null, loading: false, authInitialized: true });
      },

      refreshProfile: async () => {
        const profile = await getCurrentProfile();
        set({ profile });
      },
    }),
    {
      name: "corelia-auth",
      /** Rehydrate xong coi như đã load → không hiện loading khi reload */
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        loading: false,
      }),
    },
  ),
);

/** Hook giữ API giống useAuth cũ: session, profile, loading, signOut, refreshProfile, isAuthenticated, role, hasRole */
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
