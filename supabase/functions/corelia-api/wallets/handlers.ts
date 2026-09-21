import bs58 from "npm:bs58@6.0.0";
import { getAddress, isAddress, verifyMessage } from "npm:viem@2.56.8";

import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

type Chain = "ethereum" | "solana";

function normalizeAddress(chain: Chain, address: string): string | null {
  if (chain === "ethereum") return isAddress(address) ? getAddress(address).toLowerCase() : null;
  try {
    return bs58.decode(address).length === 32 ? address : null;
  } catch {
    return null;
  }
}

function parseInput(value: unknown): { chain: Chain; address: string } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.chain !== "ethereum" && input.chain !== "solana") return null;
  if (typeof input.address !== "string") return null;
  const address = normalizeAddress(input.chain, input.address);
  return address ? { chain: input.chain, address } : null;
}

export async function handleWalletChallenge(req: Request, db: SupabaseClient): Promise<Response> {
  let user;
  try { user = await verifyBearerUser(req, db); } catch { return json({ message: "unauthenticated" }, 401); }
  const origin = req.headers.get("origin");
  if (!origin) return json({ message: "origin_required" }, 403);
  const input = parseInput(await req.json().catch(() => null));
  if (!input) return json({ message: "invalid_wallet" }, 400);
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const message = `Corelia wallet connection\nOrigin: ${origin}\nUser: ${user.id}\nChain: ${input.chain}\nAddress: ${input.address}\nNonce: ${nonce}\nExpires: ${expiresAt}\n\nSign to connect this wallet. No transaction will be sent.`;
  const { data, error } = await db.from("wallet_link_challenges").insert({
    user_id: user.id, chain: input.chain, address: input.address,
    message, expires_at: expiresAt,
  }).select("id").single();
  if (error || !data) return json({ message: "challenge_failed" }, 500);
  return json({ challengeId: data.id, message });
}

export async function handleWalletVerify(req: Request, db: SupabaseClient): Promise<Response> {
  let user;
  try { user = await verifyBearerUser(req, db); } catch { return json({ message: "unauthenticated" }, 401); }
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.challengeId !== "string" || typeof body.signature !== "string") return json({ message: "invalid_signature" }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(body.challengeId)) return json({ message: "invalid_challenge" }, 400);
  const { data: challenge, error } = await db.from("wallet_link_challenges")
    .select("id,user_id,chain,address,message,expires_at,consumed_at")
    .eq("id", body.challengeId).eq("user_id", user.id).maybeSingle();
  if (error) return json({ message: "challenge_failed" }, 500);
  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) return json({ message: "challenge_expired" }, 409);
  if (!challenge.message.includes(`Origin: ${req.headers.get("origin") ?? ""}\n`)) return json({ message: "origin_mismatch" }, 403);
  let valid = false;
  try {
    if (challenge.chain === "ethereum") {
      valid = await verifyMessage({ address: challenge.address as `0x${string}`, message: challenge.message, signature: body.signature as `0x${string}` });
    } else if (challenge.chain === "solana") {
      const signed = typeof body.signedMessage === "string" ? bs58.decode(body.signedMessage) : new TextEncoder().encode(challenge.message);
      const expected = new TextEncoder().encode(challenge.message);
      if (signed.length === expected.length && signed.every((byte, i) => byte === expected[i])) {
        const key = await crypto.subtle.importKey("raw", bs58.decode(challenge.address), { name: "Ed25519" }, false, ["verify"]);
        valid = await crypto.subtle.verify({ name: "Ed25519" }, key, bs58.decode(body.signature), signed);
      }
    }
  } catch { valid = false; }
  if (!valid) return json({ message: "invalid_signature" }, 400);
  const { data: result, error: linkError } = await db.rpc("xp_consume_wallet_challenge", { p_challenge_id: challenge.id, p_user_id: user.id });
  if (linkError) return json({ message: "wallet_link_failed" }, 500);
  if (!result?.linked) return json({ message: "wallet_already_linked_or_challenge_expired" }, 409);
  return json({ linked: true, awarded: Boolean(result.awarded) });
}
