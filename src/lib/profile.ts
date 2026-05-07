import { supabase } from "@/lib/supabase";
import { uploadUserAvatar } from "@/lib/storage";
import type { User } from "@supabase/supabase-js";
import type { Profile, ProfileInsert, ProfileUpdate, PublicProfile } from "@/types/database";
import { sortLocale } from "@/lib/intl";
import { makeTTLCache } from "@/lib/utils";

const instructorProfilesCache = makeTTLCache<Profile[]>(3 * 60 * 1000);

/** Per-user cache so switching accounts cannot reuse another user's in-flight/resolved profile. */
const profilePromiseCache = new Map<string, { promise: Promise<Profile | null>; ts: number }>();
const CURRENT_PROFILE_TTL = 30_000;

export function invalidateCurrentProfileCache(userId?: string) {
  if (userId) profilePromiseCache.delete(userId);
  else profilePromiseCache.clear();
}

function getCachedProfilePromise(userId: string): Promise<Profile | null> | null {
  const entry = profilePromiseCache.get(userId);
  if (entry && Date.now() - entry.ts < CURRENT_PROFILE_TTL) return entry.promise;
  return null;
}

function setCachedProfilePromise(userId: string, promise: Promise<Profile | null>) {
  profilePromiseCache.set(userId, { promise, ts: Date.now() });
  promise.catch(() => {
    const cur = profilePromiseCache.get(userId);
    if (cur?.promise === promise) profilePromiseCache.delete(userId);
  });
}

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    role: row.role as Profile["role"],
    username: (row.username as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    profile_public: (row.profile_public as boolean | null) ?? true,
    locale: (row.locale as Profile["locale"]) ?? null,
    ocid: (row.ocid as string | null) ?? null,
    ocid_eth_address: (row.ocid_eth_address as string | null) ?? null,
    ocid_connected_at: (row.ocid_connected_at as string | null) ?? null,
    instructor_origin: row.instructor_origin as Profile["instructor_origin"],
    instructor_headline: (row.instructor_headline as string | null) ?? null,
    instructor_bio: (row.instructor_bio as string | null) ?? null,
    instructor_organization: (row.instructor_organization as string | null) ?? null,
    instructor_website: (row.instructor_website as string | null) ?? null,
    partner_contract_docs: (row.partner_contract_docs as Profile["partner_contract_docs"]) ?? [],
    partner_invoice_docs: (row.partner_invoice_docs as Profile["partner_invoice_docs"]) ?? [],
    partner_transfer_info: (row.partner_transfer_info as string | null) ?? null,
    partner_bank_name: (row.partner_bank_name as string | null) ?? null,
    partner_bank_account_number: (row.partner_bank_account_number as string | null) ?? null,
    partner_bank_account_holder: (row.partner_bank_account_holder as string | null) ?? null,
    partner_bank_transfer_note: (row.partner_bank_transfer_note as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToPublicProfile(row: Record<string, unknown>): PublicProfile {
  return {
    id: String(row.id),
    username: (row.username as string | null) ?? null,
    ocid: (row.ocid as string | null) ?? null,
    role: row.role as PublicProfile["role"],
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    instructor_origin: (row.instructor_origin as PublicProfile["instructor_origin"]) ?? null,
    instructor_headline: (row.instructor_headline as string | null) ?? null,
    instructor_bio: (row.instructor_bio as string | null) ?? null,
    instructor_organization: (row.instructor_organization as string | null) ?? null,
    instructor_website: (row.instructor_website as string | null) ?? null,
    profile_public: (row.profile_public as boolean | null) ?? true,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function _fetchProfileForUser(user: User): Promise<Profile | null> {
  const { data: row, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Could not read profile:", error);
    return fallbackProfile({ id: user.id, email: user.email ?? null, user_metadata: user.user_metadata ?? {} });
  }

  if (!row) {
    const insert: ProfileInsert & { created_at: string; updated_at: string } = {
      id: user.id,
      role: "student",
      locale: "vi",
      profile_public: true,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      phone: user.phone ?? null,
      email: user.email ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert(insert)
      .select("*")
      .single();
    if (insErr || !created) {
      console.warn("Profile insert failed:", insErr);
      return fallbackProfile({ id: user.id, email: user.email ?? null, user_metadata: user.user_metadata ?? {} });
    }
    return rowToProfile(created as Record<string, unknown>);
  }

  const p = rowToProfile(row as Record<string, unknown>);
  const updates: Record<string, unknown> = {};
  if ((p.email == null || p.email === "") && user.email) updates.email = user.email;
  if ((p.full_name == null || p.full_name === "") && user.user_metadata?.full_name) {
    updates.full_name = String(user.user_metadata.full_name);
  }
  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { data: upd } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("*")
      .single();
    if (upd) return rowToProfile(upd as Record<string, unknown>);
    return { ...p, ...updates } as Profile;
  }
  return p;
}

export function getCurrentProfile(): Promise<Profile | null> {
  return (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return getProfileForUser(user);
  })();
}

/**
 * Fetch current user's profile using a known `User` object (avoids calling `supabase.auth.getUser()`
 * during auth initialization / refresh, which can contend on the auth-token lock).
 */
export function getProfileForUser(user: User): Promise<Profile | null> {
  const hit = getCachedProfilePromise(user.id);
  if (hit) return hit;
  const promise = _fetchProfileForUser(user);
  setCachedProfilePromise(user.id, promise);
  return promise;
}

function fallbackProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Profile {
  const now = new Date().toISOString();
  return {
    id: user.id,
    role: "student",
    username: null,
    full_name: (user.user_metadata?.full_name as string) ?? null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    phone: null,
    email: user.email ?? null,
    bio: null,
    website: null,
    profile_public: true,
    locale: "vi",
    created_at: now,
    updated_at: now,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data as Record<string, unknown>);
}

export async function setNewUserProfileForUser(
  user: User,
  data: {
    full_name?: string | null;
    email?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      role: "student",
      locale: "vi",
      full_name: data.full_name ?? (user.user_metadata?.full_name as string) ?? null,
      email: data.email ?? user.email ?? null,
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      phone: user.phone ?? null,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  invalidateCurrentProfileCache(user.id);
}

export async function setNewUserProfile(data: {
  full_name?: string | null;
  email?: string | null;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  await setNewUserProfileForUser(user, data);
}

export async function updateProfileForUser(
  user: User,
  updates: ProfileUpdate,
): Promise<Profile> {
  const safeUpdates: Record<string, unknown> = {};
  if (updates.username !== undefined) safeUpdates.username = updates.username;
  if (updates.full_name !== undefined) safeUpdates.full_name = updates.full_name;
  if (updates.avatar_url !== undefined) safeUpdates.avatar_url = updates.avatar_url;
  if (updates.phone !== undefined) safeUpdates.phone = updates.phone;
  if (updates.email !== undefined) safeUpdates.email = updates.email;
  if (updates.bio !== undefined) safeUpdates.bio = updates.bio;
  if (updates.website !== undefined) safeUpdates.website = updates.website;
  if (updates.profile_public !== undefined) safeUpdates.profile_public = updates.profile_public;
  if (updates.locale !== undefined) safeUpdates.locale = updates.locale;
  if (updates.instructor_headline !== undefined) safeUpdates.instructor_headline = updates.instructor_headline;
  if (updates.instructor_bio !== undefined) safeUpdates.instructor_bio = updates.instructor_bio;
  if (updates.instructor_organization !== undefined) {
    safeUpdates.instructor_organization = updates.instructor_organization;
  }
  if (updates.instructor_website !== undefined) safeUpdates.instructor_website = updates.instructor_website;

  safeUpdates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(safeUpdates)
    .eq("id", user.id)
    .select("*")
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Cập nhật profile thất bại");
  invalidateCurrentProfileCache(user.id);
  return rowToProfile(updated as Record<string, unknown>);
}

export async function updateCurrentProfile(updates: ProfileUpdate): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  return updateProfileForUser(user, updates);
}

export async function updateOCIDProfileForUser(
  user: User,
  input: {
    ocid: string | null;
    ocid_eth_address: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const willConnect = Boolean(input.ocid);
  const { error } = await supabase
    .from("profiles")
    .update({
      ocid: input.ocid,
      ocid_eth_address: input.ocid_eth_address,
      ocid_connected_at: willConnect ? now : null,
      updated_at: now,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  invalidateCurrentProfileCache(user.id);
}

export async function updateOCIDProfile(input: {
  ocid: string | null;
  ocid_eth_address: string | null;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  await updateOCIDProfileForUser(user, input);
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToProfile(r as Record<string, unknown>));
}

export async function listCoreliaInstructorProfiles(): Promise<Profile[]> {
  const cached = instructorProfilesCache.get("all");
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "instructor")
      .eq("instructor_origin", "corelia");
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r) => rowToProfile(r as Record<string, unknown>))
      .sort((a, b) => {
        const nameA = (a.full_name ?? a.email ?? a.id).toLowerCase();
        const nameB = (b.full_name ?? b.email ?? b.id).toLowerCase();
        return nameA.localeCompare(nameB, sortLocale());
      });
  })();
  instructorProfilesCache.set("all", promise);
  promise.catch(() => instructorProfilesCache.delete("all"));
  return promise;
}

export function invalidateInstructorProfilesCache() {
  instructorProfilesCache.clear();
}

export async function uploadAvatarForUser(user: User, file: File): Promise<string> {
  const { url } = await uploadUserAvatar(user.id, file);
  return url;
}

export async function uploadAvatar(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  return uploadAvatarForUser(user, file);
}

export async function updateProfileAdmin(userId: string, updates: ProfileUpdate): Promise<void> {
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw new Error(error.message);
  invalidateCurrentProfileCache(userId);
}

export async function getPublicProfileByHandle(handle: string): Promise<PublicProfile | null> {
  const h = handle.trim();
  if (!h) return null;

  // Single query: match lower(username) OR exact ocid
  const { data, error } = await supabase
    .from("public_profiles")
    .select("*")
    .or(`username.ilike.${h},ocid.eq.${h}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return rowToPublicProfile(data as Record<string, unknown>);
}
