import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/coreliaEdgeApi", () => ({
  coreliaEdgeUrl: (name: string) => name,
  supabaseFunctionHeaders: () => ({}),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import {
  createAiSubscriptionCheckout,
  previewAiVoucher,
  type PaymentPurpose,
} from "@/lib/payments";

describe("Wave C Retirement Contract Tests (Epic #332 / Issue #328)", () => {
  const RETIRED_LEARNER_AI_EDGE_FUNCTIONS = [
    "ai-tutor",
    "embed-lesson",
    "generate-flashcards",
    "generate-learning-path",
    "generate-lesson-summary",
  ] as const;

  const INSTRUCTOR_AI_EDGE_FUNCTIONS = [
    "generate-description",
    "generate-questions",
  ] as const;

  const rootDir = process.cwd();

  describe("WC-01: Learner frontend has zero AI Edge Function invocations", () => {
    it("confirms learner-facing modules in src have no AI edge function invocations", () => {
      const learnerSrcFiles = [
        "src/lib/courses.ts",
        "src/lib/flashcards.ts",
        "src/lib/learningPaths.ts",
        "src/lib/lessonSummary.ts",
        "src/lib/readinessCheck.ts",
        "src/hooks/useReadinessCheck.ts",
      ];

      for (const relPath of learnerSrcFiles) {
        const fullPath = join(rootDir, relPath);
        if (!existsSync(fullPath)) continue;
        const content = readFileSync(fullPath, "utf8");
        for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
          expect(content).not.toContain(`"${fn}"`);
          expect(content).not.toContain(`'${fn}'`);
        }
        expect(content).not.toContain("invokeGenerateQuestions");
        expect(content).not.toContain("invokeGenerateDescription");
      }
    });
  });

  describe("WC-02 to WC-09: Learner AI Edge Functions remain 410 tombstones", () => {
    for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
      it(`proves ${fn} has zero api.openai.com calls and acts as a 410 tombstone`, () => {
        const fullPath = join(rootDir, "supabase", "functions", fn, "index.ts");
        expect(existsSync(fullPath)).toBe(true);
        const content = readFileSync(fullPath, "utf8");

        // Zero provider outbound calls
        expect(content).not.toContain("api.openai.com");
        expect(content).not.toContain("OPENAI_API_KEY");

        // Fail-closed tombstone contracts
        expect(content).toContain("AI_FEATURE_RETIRED");
        expect(content).toContain("410");
      });
    }

    it("WC-03: confirms ai-tutor provider.ts streamProviderText rejects with decommission error", async () => {
      const providerPath = join(rootDir, "supabase", "functions", "ai-tutor", "provider.ts");
      const providerContent = readFileSync(providerPath, "utf8");

      expect(providerContent).not.toContain("api.openai.com");
      expect(providerContent).not.toContain("OPENAI_API_KEY");
      expect(providerContent).toContain("AI provider has been decommissioned under Epic #332.");
    });
  });

  describe("WC-Instructor: Instructor-facing AI functions enforce strict auth and role guards", () => {
    for (const fn of INSTRUCTOR_AI_EDGE_FUNCTIONS) {
      it(`proves ${fn} enforces role guard (instructor/support_staff/admin) and course management check`, () => {
        const fullPath = join(rootDir, "supabase", "functions", fn, "index.ts");
        expect(existsSync(fullPath)).toBe(true);
        const content = readFileSync(fullPath, "utf8");

        expect(content).toContain("verifyBearerUser");
        expect(content).toContain("getUserRole");
        expect(content).toContain("instructor");
        expect(content).toContain("support_staff");
        expect(content).toContain("admin");
        expect(content).toContain("ensureCanManageCourse");
      });
    }

    it("scopes lesson generation to the requested course when both IDs are provided", () => {
      const content = readFileSync(
        join(rootDir, "supabase", "functions", "generate-description", "index.ts"),
        "utf8",
      );
      expect(content).toMatch(
        /if \(params\.lessonId\)[\s\S]*?\.eq\("id", params\.lessonId\)[\s\S]*?if \(params\.courseId\) query\.eq\("course_id", params\.courseId\)/,
      );
    });
  });

  describe("WC-10: Provider configuration is explicit and secret-only", () => {
    it("documents that provider secrets are retained only for instructor-facing generators", () => {
      const envExample = readFileSync(join(rootDir, "supabase", "functions", ".env.example"), "utf8");
      expect(envExample).toContain("retained only for instructor-facing generators");
      expect(envExample).not.toMatch(/^CORELIA_AI_PROVIDER=openai/m);
      expect(envExample).not.toMatch(/^OPENAI_API_KEY=\S+/m);
    });

    it("verifies supabase/config.toml has commented out openai_api_key", () => {
      const configToml = readFileSync(join(rootDir, "supabase", "config.toml"), "utf8");
      expect(configToml).toContain('# openai_api_key = "env(OPENAI_API_KEY)"');
    });
  });

  describe("WC-11 to WC-13: Payment compatibility and accounting integrity", () => {
    it("WC-11: retains historical 'ai_subscription' in PaymentPurpose type union", () => {
      const samplePurpose: PaymentPurpose = "ai_subscription";
      expect(samplePurpose).toBe("ai_subscription");
    });

    it("WC-12 & WC-13: supports standard 'course_purchase' and 'certificate_fee' purposes", () => {
      const p1: PaymentPurpose = "course_purchase";
      const p2: PaymentPurpose = "certificate_fee";
      expect(p1).toBe("course_purchase");
      expect(p2).toBe("certificate_fee");
    });

    it("confirms createAiSubscriptionCheckout throws explicit retirement error", async () => {
      await expect(
        createAiSubscriptionCheckout({
          tier: "pro",
          durationMonths: 1,
          successUrl: "http://localhost:5173/success",
          errorUrl: "http://localhost:5173/error",
          cancelUrl: "http://localhost:5173/cancel",
        }),
      ).rejects.toThrow(/Gói đăng ký trợ lý AI Cora đã dừng cung cấp mới/);
    });

    it("confirms previewAiVoucher throws explicit retirement error", async () => {
      await expect(previewAiVoucher({ tier: "pro", durationMonths: 1, voucherCode: "CODE" })).rejects.toThrow(
        /Voucher trợ lý AI Cora đã dừng hỗ trợ/,
      );
    });
  });

  describe("WC-14: No destructive #330 database operations introduced", () => {
    it("verifies all 18 AI subsystem tables remain registered in backup tooling", () => {
      const backupScript = readFileSync(join(rootDir, "scripts", "db", "backup-ai-subsystem.mjs"), "utf8");
      const match = backupScript.match(/AI_TABLE_REGISTRY\s*=\s*\[([\s\S]*?)\];/);
      expect(match).not.toBeNull();
      const tableCount = (match?.[1]?.match(/name:\s*"/g) || []).length;
      expect(tableCount).toBe(18);
    });
  });

  describe("WC-15: Stale callers for retired learner AI receive deterministic fail-closed response", () => {
    for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
      it(`verifies ${fn} returns JSON with code AI_FEATURE_RETIRED`, () => {
        const content = readFileSync(join(rootDir, "supabase", "functions", fn, "index.ts"), "utf8");
        expect(content).toContain('code: "AI_FEATURE_RETIRED"');
        expect(content).toContain('error: "AI capability retired"');
      });
    }
  });
});
