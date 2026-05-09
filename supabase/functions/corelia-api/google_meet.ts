/**
 * Google Meet Admin API helpers (JWT service account).
 * Not wired into any handler yet — import when Meet-backed flows are added.
 */
import {
  base64UrlEncode,
  bytesToBase64Url,
  pemPkcs8ToBinary,
  rsaSignPkcs1Sha256,
} from "./lib/crypto.ts";
import { requireEnv } from "./lib/env.ts";

async function getGoogleMeetAccessToken(): Promise<string> {
  const clientEmail = requireEnv("GOOGLE_MEET_CLIENT_EMAIL");
  const privateKey = requireEnv("GOOGLE_MEET_PRIVATE_KEY").replace(/\\n/g, "\n");
  const delegatedUser = requireEnv("GOOGLE_MEET_DELEGATED_USER");
  const now = Math.floor(Date.now() / 1000);
  const scope = [
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.settings",
  ].join(" ");
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: delegatedUser,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))
    }`;
  const sigBytes = await rsaSignPkcs1Sha256(privateKey, unsigned);
  const assertion = `${unsigned}.${bytesToBase64Url(sigBytes)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Không lấy được Google access token.");
  }
  return json.access_token;
}

export async function meetApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getGoogleMeetAccessToken();
  const res = await fetch(`https://meet.googleapis.com/v2${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(payload.error?.message || payload.message || `Google Meet API error (${res.status})`);
  }
  return payload;
}
