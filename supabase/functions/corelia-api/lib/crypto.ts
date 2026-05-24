export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  let d = 0;
  for (let i = 0; i < ae.length; i++) d |= ae[i]! ^ be[i]!;
  return d === 0;
}

export function randomHex(bytes: number): string {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  return Array.from(u, (x) => x.toString(16).padStart(2, "0")).join("");
}

// Unambiguous alphanumeric alphabet — excludes O/0 and I/1/L lookalikes
const ALPHANUM = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomAlphanumeric(length: number): string {
  const u = new Uint8Array(length * 2);
  crypto.getRandomValues(u);
  let result = "";
  for (let i = 0; i < u.length && result.length < length; i++) {
    const idx = u[i]! % ALPHANUM.length;
    result += ALPHANUM[idx];
  }
  return result;
}

export async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function pemPkcs8ToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function rsaSignPkcs1Sha256(privateKeyPem: string, message: string): Promise<Uint8Array> {
  const pk = await crypto.subtle.importKey(
    "pkcs8",
    pemPkcs8ToBinary(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pk,
    new TextEncoder().encode(message),
  );
  return new Uint8Array(sig);
}

export function bytesToBase64Url(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
