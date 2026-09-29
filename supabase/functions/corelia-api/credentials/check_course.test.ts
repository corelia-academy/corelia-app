import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const { mint } = vi.hoisted(() => ({ mint: vi.fn() }));
vi.mock("./mint.ts", () => ({ mintCredentialOnce: mint }));
vi.mock("./settings.ts", () => ({ getDefaultMintNetwork: async () => "mainnet" }));

import { evaluateCourseCredentialEligibility, runCourseCredentialCheck } from "./check_course.ts";

it("does not offer a new course credential while the course is updating", async () => {
  const rpc = vi.fn();
  const db = {
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: table === "courses" ? { data: { is_updating: true } } : { id: "enrollment" }, error: null };
        },
      };
    },
    rpc,
  } as unknown as SupabaseClient;

  await expect(evaluateCourseCredentialEligibility(db, "course", "learner", {}))
    .resolves.toEqual({ eligible: false, reason: "course_updating" });
  expect(rpc).not.toHaveBeenCalled();
});

it("retries a paused course credential after the update is finished", async () => {
  const issuance = { id: "issuance", status: "pending", error_message: "course_updating" };
  mint.mockImplementationOnce(async () => { issuance.status = "minted"; return { ok: true }; });
  const db = {
    from(table: string) {
      return {
        columns: "",
        select(columns: string) { this.columns = columns; return this; },
        eq() { return this; },
        in() { return this; },
        limit() { return this; },
        async maybeSingle() {
          const data = table === "credential_templates"
            ? { id: "template", collection_symbol: "ocbadge", trigger_rule: {}, identifier_prefix: "corelia:test" }
            : table === "courses"
              ? { data: { is_updating: false } }
              : table === "enrollments"
                ? { id: "enrollment" }
                : this.columns === "status"
                  ? { status: issuance.status }
                  : issuance;
          return { data, error: null };
        },
      };
    },
    rpc: async () => ({ data: { lesson_total: 1, completed_distinct: 1 }, error: null }),
  } as unknown as SupabaseClient;

  await expect(runCourseCredentialCheck(db, "course", "learner"))
    .resolves.toMatchObject({ minted: true, status: "minted" });
  expect(mint).toHaveBeenCalledWith(db, issuance.id);
});
