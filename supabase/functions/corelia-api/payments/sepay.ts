import { hmacSha256Base64 } from "../lib/crypto.ts";
import { requireEnv } from "../lib/env.ts";
import type { SePayTransactionListItem } from "./types.ts";

function getSePayEnv(): "sandbox" | "production" {
  return String(Deno.env.get("SEPAY_ENV") ?? "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function sepayUserApiBaseUrl(): string {
  const explicit = Deno.env.get("SEPAY_USERAPI_BASE_URL")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return getSePayEnv() === "production" ? "https://userapi.sepay.vn/v2" : "https://userapi-sandbox.sepay.vn/v2";
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesInvoiceMarker(tx: SePayTransactionListItem, invoiceLower: string): boolean {
  const candidates = [
    normalize(tx.reference_number),
    normalize(tx.code),
    normalize(tx.transaction_content),
  ].filter(Boolean);
  return candidates.some((v) => v === invoiceLower || v.includes(invoiceLower));
}

export async function fetchSePayIncomingTransactionByInvoiceNumber(
  invoiceNumber: string,
  expectedAmountVnd: number,
): Promise<SePayTransactionListItem | null> {
  const token = requireEnv("SEPAY_API_TOKEN");
  const invoice = invoiceNumber.trim();
  const invoiceLower = invoice.toLowerCase();
  if (!invoice) return null;

  const url = new URL(`${sepayUserApiBaseUrl()}/transactions`);
  url.searchParams.set("q", invoice);
  url.searchParams.set("transfer_type", "in");
  url.searchParams.set("amount_in_min", String(expectedAmountVnd));
  url.searchParams.set("amount_in_max", String(expectedAmountVnd));
  url.searchParams.set("transaction_date_sort", "desc");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "100");
  const bankAccountId = Deno.env.get("SEPAY_BANK_ACCOUNT_ID")?.trim() ?? "";
  if (bankAccountId) url.searchParams.set("bank_account_id", bankAccountId);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SePay v2 transaction lookup failed (${res.status}): ${text || "empty response"}`);
  }

  const parsed = (await res.json().catch(() => ({}))) as { data?: unknown };
  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  const items = rows as SePayTransactionListItem[];
  return items.find((tx) => {
    const transferType = normalize(tx.transfer_type);
    if (transferType && transferType !== "in") return false;
    const amountIn = Math.round(Number(tx.amount_in ?? 0));
    if (!Number.isFinite(amountIn) || amountIn !== expectedAmountVnd) return false;
    return matchesInvoiceMarker(tx, invoiceLower);
  }) ?? null;
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
