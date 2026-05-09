import { hmacSha256Base64 } from "../lib/crypto.ts";
import { requireEnv } from "../lib/env.ts";
import type { SePayOrderListItem } from "./types.ts";

export function sepayPgApiBaseUrl(): string {
  const explicit = Deno.env.get("SEPAY_PGAPI_BASE_URL")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const sandbox = String(Deno.env.get("SEPAY_SANDBOX") ?? "").toLowerCase() === "true";
  return sandbox ? "https://pgapi-sandbox.sepay.vn" : "https://pgapi.sepay.vn";
}

export function sepayBasicAuthHeader(): string {
  const merchantId = requireEnv("SEPAY_MERCHANT_ID");
  const secretKey = requireEnv("SEPAY_SECRET_KEY");
  const raw = `${merchantId}:${secretKey}`;
  return `Basic ${btoa(raw)}`;
}

export async function fetchSePayOrderByInvoiceNumber(
  invoiceNumber: string,
  userId?: string,
): Promise<SePayOrderListItem | null> {
  const url = new URL(`${sepayPgApiBaseUrl()}/v1/order`);
  url.searchParams.set("q", invoiceNumber);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", "1");
  url.searchParams.set("sort", "created_at:desc");
  if (userId) url.searchParams.set("customer_id", userId);
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: sepayBasicAuthHeader(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SePay order lookup failed (${res.status}): ${text || "empty response"}`);
  }
  const data = (await res.json().catch(() => ({}))) as { data?: SePayOrderListItem[] };
  const orders = Array.isArray(data.data) ? data.data : [];
  return orders.find((item) => item.order_invoice_number === invoiceNumber) ?? null;
}

function getSePayEnv(): "sandbox" | "production" {
  return String(Deno.env.get("SEPAY_ENV") ?? "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

export function sepayCheckoutInitUrl(): string {
  return getSePayEnv() === "production"
    ? "https://pay.sepay.vn/v1/checkout/init"
    : "https://pay-sandbox.sepay.vn/v1/checkout/init";
}

export async function buildSePaySignature(fields: Record<string, string>, secretKey: string): Promise<string> {
  const signedFields = [
    "merchant",
    "operation",
    "payment_method",
    "order_amount",
    "currency",
    "order_invoice_number",
    "order_description",
    "customer_id",
    "success_url",
    "error_url",
    "cancel_url",
  ] as const;
  const signedString = signedFields
    .filter((k) => k in fields)
    .map((k) => `${k}=${fields[k] ?? ""}`)
    .join(",");
  return await hmacSha256Base64(secretKey, signedString);
}
