import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export async function getAuthSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthState(
  onChange: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(onChange);
  return () => subscription.unsubscribe();
}

export async function getAuthenticatorAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

export async function listMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

export async function challengeMfa(factorId: string) {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw error;
  return data;
}

export async function verifyMfa(input: {
  factorId: string;
  challengeId: string;
  code: string;
}): Promise<void> {
  const { error } = await supabase.auth.mfa.verify(input);
  if (error) throw error;
}

export async function resendSignupConfirmation(input: {
  email: string;
  captchaToken?: string;
}): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: input.email,
    ...(input.captchaToken ? { options: { captchaToken: input.captchaToken } } : {}),
  });
  if (error) throw error;
}

export async function requestPasswordReset(input: {
  email: string;
  redirectTo: string;
  captchaToken?: string;
}): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
    ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
  });
  if (error) throw error;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  captchaToken?: string;
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    ...(input.captchaToken ? { options: { captchaToken: input.captchaToken } } : {}),
  });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  locale: string;
  emailRedirectTo: string;
  captchaToken?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.emailRedirectTo,
      data: { full_name: input.fullName, locale: input.locale },
      ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithOAuth(provider: "google" | "github"): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
}

export async function updateAuthPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function changePasswordWithReauthentication(input: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await signInWithPassword({ email: input.email, password: input.currentPassword });
  await updateAuthPassword(input.newPassword);
}

export async function updateAuthLocale(locale: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { locale } });
  if (error) throw error;
}

export async function signOutFromSupabase() {
  return supabase.auth.signOut();
}
