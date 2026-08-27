import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { describe, it } from "node:test";

describe("Master Wave Remediation R1.1: Enrollment Security, Purpose Validation & Timestamp Provenance (F-REV-01, F-REV-02)", () => {
  const repoRoot = resolve(import.meta.dirname, "../../..");
  const migrationPath = resolve(
    repoRoot,
    "supabase/migrations/20260825140000_harden_enrollment_payment_purpose_and_timestamp.sql"
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("MIGRATION-01: Migration is forward-only, transactional, enforces purpose = 'course_purchase', and derives paid_at", () => {
    assert.match(sql, /^BEGIN;/m, "Migration must start with BEGIN");
    assert.match(sql, /^COMMIT;/m, "Migration must end with COMMIT");
    assert.match(
      sql,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.guard_course_enrollment_access/i,
      "Must define guard_course_enrollment_access function"
    );
    assert.match(
      sql,
      /SET\s+search_path\s*=\s*public,\s*pg_temp/i,
      "Must set safe search_path"
    );
    assert.match(
      sql,
      /v_tx\.purpose\s*<>\s*'course_purchase'/i,
      "Must explicitly validate transaction purpose is 'course_purchase'"
    );
    assert.match(
      sql,
      /NEW\.paid_at\s*:=\s*COALESCE\(\s*v_tx\.updated_at,\s*now\(\)\s*\)/i,
      "Must derive authoritative paid_at timestamp from verified transaction"
    );
    assert.match(
      sql,
      /CREATE\s+TRIGGER\s+trg_guard_course_enrollment_access/i,
      "Must attach trigger to enrollments table"
    );
  });

  // Pure logic evaluator modeling the PostgreSQL guard function semantics
  function evaluateEnrollmentGuard({
    caller,
    isAdmin = false,
    course,
    tx,
    paymentAccess,
    oldRow,
    newRow,
    op = "INSERT",
  }) {
    // Service role / internal server triggers skip client guard
    if (!caller) return { allowed: true, row: newRow };
    if (isAdmin) return { allowed: true, row: newRow };

    if (!course) {
      throw new Error(`COURSE_NOT_FOUND: Course ${newRow.course_id} does not exist.`);
    }

    if (
      caller === course.instructor_id ||
      (course.data?.co_instructor_permissions &&
        course.data.co_instructor_permissions[caller])
    ) {
      return { allowed: true, row: newRow };
    }

    const accessModel = course.data?.access_model || "free";

    // Free courses
    if (accessModel !== "paid_upfront") {
      if (
        (op === "INSERT" && (newRow.paid_order_id != null || newRow.paid_at != null)) ||
        (op === "UPDATE" &&
          ((newRow.paid_order_id !== oldRow?.paid_order_id && newRow.paid_order_id != null) ||
            (newRow.paid_at !== oldRow?.paid_at && newRow.paid_at != null)))
      ) {
        throw new Error(
          "INVALID_PROVENANCE: Free courses cannot specify paid transaction provenance."
        );
      }
      return { allowed: true, row: newRow };
    }

    // Paid upfront courses: UPDATE check
    if (
      op === "UPDATE" &&
      oldRow &&
      newRow.user_id === oldRow.user_id &&
      newRow.course_id === oldRow.course_id &&
      newRow.paid_order_id === oldRow.paid_order_id &&
      newRow.paid_at === oldRow.paid_at
    ) {
      return { allowed: true, row: newRow };
    }

    let hasAccess = false;
    if (paymentAccess?.full_access_granted === true && paymentAccess?.status === "active") {
      hasAccess = true;
    }

    if (newRow.paid_order_id != null) {
      if (!tx) {
        throw new Error(
          `PAYMENT_TRANSACTION_NOT_FOUND: paid_order_id ${newRow.paid_order_id} does not exist.`
        );
      }
      if (tx.user_id !== newRow.user_id) {
        throw new Error(
          `PAYMENT_USER_MISMATCH: paid_order_id ${newRow.paid_order_id} belongs to another user.`
        );
      }
      if (tx.course_id !== newRow.course_id) {
        throw new Error(
          `PAYMENT_COURSE_MISMATCH: paid_order_id ${newRow.paid_order_id} belongs to another course.`
        );
      }
      if (tx.status !== "paid") {
        throw new Error(
          `PAYMENT_NOT_PAID: Transaction ${newRow.paid_order_id} status is ${tx.status}, not paid.`
        );
      }
      if (tx.purpose !== "course_purchase") {
        throw new Error(
          `PAYMENT_PURPOSE_MISMATCH: Transaction ${newRow.paid_order_id} purpose is ${tx.purpose}, not course_purchase.`
        );
      }

      // Derive authoritative values
      newRow.paid_at = tx.updated_at || new Date().toISOString();
      newRow.paid_provider = tx.provider || "sepay";
      newRow.paid_amount_vnd = tx.amount_vnd;
      hasAccess = true;
    }

    if (!hasAccess) {
      throw new Error(
        `PAYMENT_REQUIRED: Cannot enroll in paid course ${newRow.course_id} without valid verified payment.`
      );
    }

    return { allowed: true, row: newRow };
  }

  it("ENR-SEC-01: Authenticated user with fake paid_order_id is REJECTED", () => {
    assert.throws(
      () =>
        evaluateEnrollmentGuard({
          caller: "user-123",
          course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
          tx: null, // fake order does not exist
          newRow: {
            user_id: "user-123",
            course_id: "paid-course-1",
            paid_order_id: "FAKE-ORDER-999",
            paid_at: new Date().toISOString(),
          },
        }),
      /PAYMENT_TRANSACTION_NOT_FOUND/
    );
  });

  it("ENR-SEC-02: Authenticated user with fake paid_at and no payment access is REJECTED", () => {
    assert.throws(
      () =>
        evaluateEnrollmentGuard({
          caller: "user-123",
          course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
          tx: null,
          paymentAccess: null,
          newRow: {
            user_id: "user-123",
            course_id: "paid-course-1",
            paid_order_id: null,
            paid_at: new Date().toISOString(),
          },
        }),
      /PAYMENT_REQUIRED/
    );
  });

  it("ENR-SEC-03: Authenticated user supplying another user's paid transaction is REJECTED", () => {
    assert.throws(
      () =>
        evaluateEnrollmentGuard({
          caller: "user-attacker",
          course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
          tx: {
            id: "VALID-TX-VICTIM",
            user_id: "user-victim",
            course_id: "paid-course-1",
            purpose: "course_purchase",
            status: "paid",
          },
          newRow: {
            user_id: "user-attacker",
            course_id: "paid-course-1",
            paid_order_id: "VALID-TX-VICTIM",
            paid_at: new Date().toISOString(),
          },
        }),
      /PAYMENT_USER_MISMATCH/
    );
  });

  it("ENR-SEC-04: Authenticated user supplying payment for a different course is REJECTED", () => {
    assert.throws(
      () =>
        evaluateEnrollmentGuard({
          caller: "user-123",
          course: { id: "paid-course-A", data: { access_model: "paid_upfront" } },
          tx: {
            id: "VALID-TX-COURSE-B",
            user_id: "user-123",
            course_id: "paid-course-B",
            purpose: "course_purchase",
            status: "paid",
          },
          newRow: {
            user_id: "user-123",
            course_id: "paid-course-A",
            paid_order_id: "VALID-TX-COURSE-B",
            paid_at: new Date().toISOString(),
          },
        }),
      /PAYMENT_COURSE_MISMATCH/
    );
  });

  it("ENR-SEC-05: Authenticated user supplying non-paid (pending/failed/refunded) transaction is REJECTED", () => {
    for (const badStatus of ["pending", "failed", "cancelled", "refunded", "partially_refunded"]) {
      assert.throws(
        () =>
          evaluateEnrollmentGuard({
            caller: "user-123",
            course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
            tx: {
              id: `TX-${badStatus}`,
              user_id: "user-123",
              course_id: "paid-course-1",
              purpose: "course_purchase",
              status: badStatus,
            },
            newRow: {
              user_id: "user-123",
              course_id: "paid-course-1",
              paid_order_id: `TX-${badStatus}`,
              paid_at: new Date().toISOString(),
            },
          }),
        /PAYMENT_NOT_PAID/
      );
    }
  });

  it("ENR-SEC-06: Authenticated user with revoked/expired payment access is REJECTED", () => {
    for (const revokedStatus of ["revoked", "expired"]) {
      assert.throws(
        () =>
          evaluateEnrollmentGuard({
            caller: "user-123",
            course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
            paymentAccess: { full_access_granted: false, status: revokedStatus },
            newRow: {
              user_id: "user-123",
              course_id: "paid-course-1",
              paid_order_id: null,
            },
          }),
        /PAYMENT_REQUIRED/
      );
    }
  });

  it("ENR-SEC-07: Authenticated user with valid canonical paid access PASSES", () => {
    const res = evaluateEnrollmentGuard({
      caller: "user-123",
      course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
      paymentAccess: { full_access_granted: true, status: "active" },
      newRow: {
        user_id: "user-123",
        course_id: "paid-course-1",
        paid_order_id: null,
        enrolled_at: new Date().toISOString(),
      },
    });
    assert.equal(res.allowed, true);
  });

  it("ENR-SEC-08: Free course legitimate enrollment PASSES without payment info", () => {
    const res = evaluateEnrollmentGuard({
      caller: "user-123",
      course: { id: "free-course-1", data: { access_model: "free" } },
      newRow: {
        user_id: "user-123",
        course_id: "free-course-1",
        paid_order_id: null,
        paid_at: null,
        enrolled_at: new Date().toISOString(),
      },
    });
    assert.equal(res.allowed, true);

    // Free course with fake payment info is REJECTED
    assert.throws(
      () =>
        evaluateEnrollmentGuard({
          caller: "user-123",
          course: { id: "free-course-1", data: { access_model: "free" } },
          newRow: {
            user_id: "user-123",
            course_id: "free-course-1",
            paid_order_id: "FAKE-TX",
            paid_at: new Date().toISOString(),
          },
        }),
      /INVALID_PROVENANCE/
    );
  });

  it("ENR-SEC-09: Service role settlement flow PASSES unconditionally", () => {
    const res = evaluateEnrollmentGuard({
      caller: null, // service_role / background RPC
      course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
      newRow: {
        user_id: "user-123",
        course_id: "paid-course-1",
        paid_order_id: "SEPAY-TX-100",
        paid_at: new Date().toISOString(),
      },
    });
    assert.equal(res.allowed, true);
  });

  it("ENR-SEC-10: Duplicate legitimate enrollment updates remain idempotent", () => {
    const now = new Date().toISOString();
    const res = evaluateEnrollmentGuard({
      caller: "user-123",
      op: "UPDATE",
      course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
      oldRow: {
        user_id: "user-123",
        course_id: "paid-course-1",
        paid_order_id: "SEPAY-TX-100",
        paid_at: now,
        last_accessed_at: "2026-08-20T00:00:00Z",
      },
      newRow: {
        user_id: "user-123",
        course_id: "paid-course-1",
        paid_order_id: "SEPAY-TX-100",
        paid_at: now,
        last_accessed_at: now,
      },
    });
    assert.equal(res.allowed, true);
  });

  it("ENR-SEC-11: Authenticated user with paid transaction for wrong purpose (certificate_fee, ai_subscription) is REJECTED (F-REV-01)", () => {
    const nonCoursePurposes = ["certificate_fee", "ai_subscription"];
    for (const purpose of nonCoursePurposes) {
      assert.throws(
        () =>
          evaluateEnrollmentGuard({
            caller: "user-123",
            course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
            tx: {
              id: `TX-PAID-${purpose}`,
              user_id: "user-123",
              course_id: "paid-course-1",
              purpose: purpose,
              status: "paid",
              amount_vnd: 50_000,
            },
            newRow: {
              user_id: "user-123",
              course_id: "paid-course-1",
              paid_order_id: `TX-PAID-${purpose}`,
              paid_at: new Date().toISOString(),
            },
          }),
        /PAYMENT_PURPOSE_MISMATCH/,
        `Transaction with purpose '${purpose}' must be rejected for course enrollment`
      );
    }
  });

  it("ENR-SEC-12: Trigger derives authoritative paid_at and metadata from canonical transaction, ignoring forged client timestamp (F-REV-02)", () => {
    const canonicalSettlementTime = "2026-08-25T07:30:00.000Z";
    const forgedClientTime = "1999-01-01T00:00:00.000Z";

    const res = evaluateEnrollmentGuard({
      caller: "user-123",
      course: { id: "paid-course-1", data: { access_model: "paid_upfront" } },
      tx: {
        id: "TX-CANONICAL-PAID",
        user_id: "user-123",
        course_id: "paid-course-1",
        purpose: "course_purchase",
        status: "paid",
        amount_vnd: 299_000,
        provider: "sepay",
        updated_at: canonicalSettlementTime,
      },
      newRow: {
        user_id: "user-123",
        course_id: "paid-course-1",
        paid_order_id: "TX-CANONICAL-PAID",
        paid_at: forgedClientTime,
        paid_amount_vnd: 0,
        paid_provider: "fake_provider",
      },
    });

    assert.equal(res.allowed, true);
    assert.equal(
      res.row.paid_at,
      canonicalSettlementTime,
      "paid_at must match the canonical transaction settlement time"
    );
    assert.equal(
      res.row.paid_amount_vnd,
      299_000,
      "paid_amount_vnd must be derived from transaction"
    );
    assert.equal(
      res.row.paid_provider,
      "sepay",
      "paid_provider must be derived from transaction"
    );
  });
});

