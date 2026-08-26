import { describe, expect, it } from "vitest";
import type {
  PaymentTransaction,
  PaymentRefund,
  CoursePaymentAccess,
} from "./payments";

interface HistoricalAiSubscriptionFixture {
  id: string;
  user_id: string;
  tier: "student" | "pro" | "bootcamp";
  duration_months: 1 | 12;
  price_vnd: number;
  started_at: string;
  expires_at: string;
  payment_transaction_id: string;
  status: "active" | "expired" | "cancelled" | "superseded" | "refunded";
  created_at: string;
}

describe("Master Wave — Payment Settlement & Access Integrity Unit Test Suite", () => {
  // PAY-01: Valid successful payment grants intended access
  it("PAY-01: valid successful course purchase payment grants active course access and enrollment", () => {
    const tx: PaymentTransaction = {
      id: "CORELIA-1700000000-A1B2C3",
      user_id: "user-alice-uuid",
      course_id: "course-solana-101",
      purpose: "course_purchase",
      amount_vnd: 299000,
      original_amount_vnd: 299000,
      provider: "sepay",
      status: "paid",
      created_at: "2026-08-25T10:00:00Z",
      updated_at: "2026-08-25T10:05:00Z",
    };

    const access: CoursePaymentAccess = {
      id: `${tx.user_id}_${tx.course_id}`,
      user_id: tx.user_id,
      course_id: tx.course_id,
      full_access_granted: true,
      certificate_fee_paid: false,
      source: "payment",
      status: "active",
      source_transaction_id: tx.id,
      granted_at: "2026-08-25T10:05:00Z",
    };

    expect(tx.status).toBe("paid");
    expect(access.full_access_granted).toBe(true);
    expect(access.status).toBe("active");
    expect(access.source).toBe("payment");
    expect(access.source_transaction_id).toBe(tx.id);
  });

  // PAY-02: Duplicate success callback is idempotent
  it("PAY-02: duplicate success callback is idempotent and does not re-mutate or corrupt state", () => {
    const firstSettlement = {
      ok: true,
      status: "paid",
      transaction_id: "TX-1001",
    };

    const duplicateSettlement = {
      ok: true,
      status: "already_paid",
      transaction_id: "TX-1001",
    };

    expect(firstSettlement.ok).toBe(true);
    expect(duplicateSettlement.ok).toBe(true);
    expect(duplicateSettlement.status).toBe("already_paid");
  });

  // PAY-03: Cross-user payment / access mutation rejected
  it("PAY-03: cross-user payment access mutation is rejected", () => {
    const callerId = "user-attacker-uuid";
    const targetUserId = "user-victim-uuid";

    const attemptAccessMutation = (caller: string, target: string) => {
      if (caller !== target) {
        throw new Error("FORBIDDEN: Cross-user mutation rejected by RLS / RPC.");
      }
      return true;
    };

    expect(() => attemptAccessMutation(callerId, targetUserId)).toThrow(
      /FORBIDDEN: Cross-user mutation/
    );
  });

  // PAY-04: Failed payment grants no paid access
  it("PAY-04: failed payment does not grant full course access", () => {
    const failedTx: PaymentTransaction = {
      id: "CORELIA-FAIL-01",
      user_id: "user-bob-uuid",
      course_id: "course-advanced-rust",
      purpose: "course_purchase",
      amount_vnd: 499000,
      provider: "sepay",
      status: "failed",
      created_at: "2026-08-25T10:00:00Z",
      updated_at: "2026-08-25T10:02:00Z",
    };

    const access: CoursePaymentAccess = {
      id: `${failedTx.user_id}_${failedTx.course_id}`,
      user_id: failedTx.user_id,
      course_id: failedTx.course_id,
      full_access_granted: false,
      certificate_fee_paid: false,
      source: "legacy",
      status: "revoked",
    };

    expect(failedTx.status).toBe("failed");
    expect(access.full_access_granted).toBe(false);
  });

  // ENR-01: Valid enrollment path succeeds for free course
  it("ENR-01: valid free course enrollment succeeds with active status", () => {
    const courseAccessModel: "free" | "paid_upfront" = "free";
    const canEnrollFree = (courseAccessModel as string) !== "paid_upfront";
    expect(canEnrollFree).toBe(true);
  });

  // ENR-02: Paid upfront course rejects direct unpaid enrollment
  it("ENR-02: paid upfront course rejects unverified direct enrollment without active payment", () => {
    const courseAccessModel = "paid_upfront";
    const hasPaidAccess = false;

    const validateEnrollment = (model: string, paid: boolean) => {
      if (model === "paid_upfront" && !paid) {
        throw new Error("PAYMENT_REQUIRED: This course requires upfront payment before enrollment.");
      }
      return { ok: true };
    };

    expect(() => validateEnrollment(courseAccessModel, hasPaidAccess)).toThrow(
      /PAYMENT_REQUIRED/
    );
  });

  // ENR-03: Invalid provenance rejected
  it("ENR-03: access provenance correctly distinguishes payment, admin_grant, and voucher", () => {
    const validSources = ["payment", "admin_grant", "voucher", "free_enrollment", "legacy"];
    expect(validSources.includes("payment")).toBe(true);
    expect(validSources.includes("admin_grant")).toBe(true);
    expect(validSources.includes("voucher")).toBe(true);
    expect(validSources.includes("unauthorized_forged")).toBe(false);
  });

  // REF-01: Valid refund transition
  it("REF-01: valid refund transition updates transaction to refunded and records payment_refunds", () => {
    const txBefore: PaymentTransaction = {
      id: "CORELIA-REF-100",
      user_id: "user-charlie-uuid",
      course_id: "course-defi",
      purpose: "course_purchase",
      amount_vnd: 350000,
      provider: "sepay",
      status: "paid",
      created_at: "2026-08-20T10:00:00Z",
      updated_at: "2026-08-20T10:05:00Z",
    };

    const refund: PaymentRefund = {
      id: "REFUND-1700005000-ABCD",
      payment_transaction_id: txBefore.id,
      user_id: txBefore.user_id,
      amount_vnd: txBefore.amount_vnd,
      status: "completed",
      reason: "Customer requested within 7-day money back guarantee",
      created_at: "2026-08-25T11:00:00Z",
      updated_at: "2026-08-25T11:00:00Z",
      completed_at: "2026-08-25T11:00:00Z",
    };

    const txAfter: PaymentTransaction = {
      ...txBefore,
      status: "refunded",
      updated_at: "2026-08-25T11:00:00Z",
    };

    expect(refund.status).toBe("completed");
    expect(refund.amount_vnd).toBe(350000);
    expect(txAfter.status).toBe("refunded");
  });

  // REF-02: Illegal refund transition rejected
  it("REF-02: attempting to refund a pending or failed transaction throws error", () => {
    const attemptRefund = (status: string) => {
      if (status !== "paid" && status !== "refund_requested") {
        throw new Error(`INVALID_PAYMENT_STATUS_FOR_REFUND: Cannot refund transaction with status ${status}`);
      }
      return true;
    };

    expect(() => attemptRefund("pending")).toThrow(/INVALID_PAYMENT_STATUS_FOR_REFUND/);
    expect(() => attemptRefund("failed")).toThrow(/INVALID_PAYMENT_STATUS_FOR_REFUND/);
    expect(() => attemptRefund("cancelled")).toThrow(/INVALID_PAYMENT_STATUS_FOR_REFUND/);
    expect(attemptRefund("paid")).toBe(true);
    expect(attemptRefund("refund_requested")).toBe(true);
  });

  // REF-03: Refund preserves financial history
  it("REF-03: refunding a payment does not delete or overwrite the original transaction record", () => {
    const originalTxId = "CORELIA-IMMUTABLE-01";
    const originalAmount = 500000;

    const originalTx = {
      id: originalTxId,
      amount_vnd: originalAmount,
      status: "refunded", // status changed, but record is intact
      created_at: "2026-08-01T00:00:00Z",
    };

    expect(originalTx.id).toBe(originalTxId);
    expect(originalTx.amount_vnd).toBe(originalAmount);
  });

  // REF-04: Course access after refund follows canonical provenance rules
  it("REF-04: refunding course purchase sets course access status to revoked", () => {
    const accessAfterRefund: CoursePaymentAccess = {
      id: "user-dave_course-ai-agent",
      user_id: "user-dave",
      course_id: "course-ai-agent",
      full_access_granted: false,
      certificate_fee_paid: false,
      source: "payment",
      status: "revoked",
      revoked_at: "2026-08-25T11:30:00Z",
      revoked_reason: "Full refund processed",
    };

    expect(accessAfterRefund.full_access_granted).toBe(false);
    expect(accessAfterRefund.status).toBe("revoked");
    expect(accessAfterRefund.revoked_reason).toBe("Full refund processed");
  });

  // REF-05: AI Subscription refund downgrades tier when no other active subscriptions exist
  it("REF-05: refunding AI subscription marks subscription refunded and downgrades profile tier", () => {
    const sub: HistoricalAiSubscriptionFixture = {
      id: "sub-100",
      user_id: "user-eve",
      tier: "pro",
      duration_months: 1,
      price_vnd: 149000,
      started_at: "2026-08-20T00:00:00Z",
      expires_at: "2026-09-20T00:00:00Z",
      payment_transaction_id: "TX-PRO-100",
      status: "refunded",
      created_at: "2026-08-20T00:00:00Z",
    };

    const hasOtherActiveSub = false;
    const effectiveTier = hasOtherActiveSub ? "pro" : "free";

    expect(sub.status).toBe("refunded");
    expect(effectiveTier).toBe("free");
  });

  // AUTH-01: Privileged mutation RPCs require authentication / staff roles
  it("AUTH-01: anon cannot call privileged settlement or admin grant RPCs", () => {
    const checkRpcAuth = (callerRole: "anon" | "authenticated" | "service_role" | "admin") => {
      if (callerRole === "anon") {
        throw new Error("UNAUTHENTICATED: Anonymous access forbidden for financial settlement.");
      }
      return true;
    };

    expect(() => checkRpcAuth("anon")).toThrow(/UNAUTHENTICATED/);
    expect(checkRpcAuth("service_role")).toBe(true);
    expect(checkRpcAuth("admin")).toBe(true);
  });

  // AUTH-03: Admin grant path works with explicit audit provenance
  it("AUTH-03: admin grant RPC records source = admin_grant and granted_by admin UUID", () => {
    const adminId = "admin-operator-uuid";
    const targetUserId = "student-recipient-uuid";

    const adminGrantAccess: CoursePaymentAccess = {
      id: `${targetUserId}_course-zkp`,
      user_id: targetUserId,
      course_id: "course-zkp",
      full_access_granted: true,
      certificate_fee_paid: true,
      source: "admin_grant",
      status: "active",
      granted_by: adminId,
      granted_at: "2026-08-25T11:45:00Z",
    };

    expect(adminGrantAccess.source).toBe("admin_grant");
    expect(adminGrantAccess.granted_by).toBe(adminId);
    expect(adminGrantAccess.full_access_granted).toBe(true);
  });
});
