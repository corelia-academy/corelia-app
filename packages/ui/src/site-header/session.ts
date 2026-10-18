/**
 * Read-only view of the learning app's Supabase session for the landing site.
 *
 * Both sites share an origin, so supabase-js's localStorage entry
 * (`sb-<project-ref>-auth-token`) is visible here. The landing site only reads it to
 * choose between "Log in" and "Go to learning"; refreshing and signing out stay in the app.
 */
export type SiteSessionUser = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const SESSION_KEY = /^sb-[a-z0-9]+-auth-token$/;

type StoredSession = {
  refresh_token?: unknown;
  user?: { email?: unknown; user_metadata?: Record<string, unknown> } | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The signed-in user, or null for guests. A session with a refresh token counts even if the access token expired. */
export function readSiteSession(storage: Pick<Storage, "length" | "key" | "getItem"> | null =
  typeof window === "undefined" ? null : window.localStorage): SiteSessionUser | null {
  if (!storage) return null;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key || !SESSION_KEY.test(key)) continue;
      const session = JSON.parse(storage.getItem(key) ?? "null") as StoredSession | null;
      if (!session || !text(session.refresh_token)) continue;
      const meta = session.user?.user_metadata ?? {};
      return {
        name: text(meta.full_name) ?? text(meta.name),
        email: text(session.user?.email),
        avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
      };
    }
  } catch {
    // Storage blocked or malformed: treat as a guest.
  }
  return null;
}
