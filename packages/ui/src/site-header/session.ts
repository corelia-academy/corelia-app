/**
 * Read-only view of the learning app's Supabase session for the landing site.
 *
 * Both sites share an origin, so supabase-js's localStorage entry
 * (`sb-<project-ref>-auth-token`) is visible here. The landing site only reads it to
 * choose between the guest buttons and the account menu; refreshing and signing out stay in the app.
 * The app also stores how it shows the user (`SITE_USER_KEY`) so both headers match.
 */
export type SiteSessionUser = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const SESSION_KEY = /^sb-[a-z0-9]+-auth-token$/;

/** The app's display name and avatar for the signed-in user, keyed by user id. */
export const SITE_USER_KEY = "corelia.siteUser.v1";

type SiteUserSnapshot = { id: string; name: string | null; avatarUrl: string | null };

type StoredSession = {
  refresh_token?: unknown;
  user?: { id?: unknown; email?: unknown; user_metadata?: Record<string, unknown> } | null;
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
      const user: SiteSessionUser = {
        name: text(meta.full_name) ?? text(meta.name),
        email: text(session.user?.email),
        avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
      };
      const snapshot = readSnapshot(storage);
      if (snapshot && snapshot.id === text(session.user?.id)) {
        return { ...user, name: snapshot.name ?? user.name, avatarUrl: snapshot.avatarUrl ?? user.avatarUrl };
      }
      return user;
    }
  } catch {
    // Storage blocked or malformed: treat as a guest.
  }
  return null;
}

function readSnapshot(storage: Pick<Storage, "getItem">): SiteUserSnapshot | null {
  const value = JSON.parse(storage.getItem(SITE_USER_KEY) ?? "null") as Partial<SiteUserSnapshot> | null;
  const id = text(value?.id);
  return id ? { id, name: text(value?.name), avatarUrl: text(value?.avatarUrl) } : null;
}

/** Called by the app when the profile loads so the landing header shows the same name and avatar. */
export function writeSiteUser(snapshot: SiteUserSnapshot,
  storage: Pick<Storage, "setItem"> | null = typeof window === "undefined" ? null : window.localStorage): void {
  try {
    storage?.setItem(SITE_USER_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage blocked or full: the landing header falls back to the session metadata.
  }
}
