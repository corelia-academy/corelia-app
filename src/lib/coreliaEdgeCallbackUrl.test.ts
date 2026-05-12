import { describe, expect, it } from "vitest";
import { isValidPaymentCallbackUrl } from "../../supabase/functions/corelia-api/payments/callback_url.ts";

describe("isValidPaymentCallbackUrl", () => {
  it("accepts URLs in explicit allowlist", () => {
    const allow = new Set<string>(["https://app.corelia.academy", "http://localhost:5173"]);
    expect(isValidPaymentCallbackUrl("https://app.corelia.academy/payment/success", allow)).toBe(true);
    expect(isValidPaymentCallbackUrl("http://localhost:5173/payment/cancel", allow)).toBe(true);
    expect(isValidPaymentCallbackUrl("https://evil.example.com/payment/success", allow)).toBe(false);
  });

  it("rejects URLs with unsupported protocol or credentials", () => {
    const allow = new Set<string>(["https://app.corelia.academy"]);
    expect(isValidPaymentCallbackUrl("javascript:alert(1)", allow)).toBe(false);
    expect(isValidPaymentCallbackUrl("https://user:pass@app.corelia.academy/payment/success", allow)).toBe(false);
  });

  it("defaults to https or local loopback when allowlist is empty", () => {
    const allow = new Set<string>();
    expect(isValidPaymentCallbackUrl("https://example.com/payment/success", allow)).toBe(true);
    expect(isValidPaymentCallbackUrl("http://localhost:5173/payment/success", allow)).toBe(true);
    expect(isValidPaymentCallbackUrl("http://127.0.0.1:5173/payment/success", allow)).toBe(true);
    expect(isValidPaymentCallbackUrl("http://example.com/payment/success", allow)).toBe(false);
  });
});
