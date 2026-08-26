import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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

describe("Wave B Retirement Contract Tests (Epic #332 / Issues #326, #327, #329, #331)", () => {
  describe("Issue #329: Cora Monetization Retirement & Historical Integrity", () => {
    it("throws explicit retirement error when createAiSubscriptionCheckout is invoked", async () => {
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

    it("throws explicit retirement error when previewAiVoucher is invoked", async () => {
      await expect(previewAiVoucher({ tier: "pro", durationMonths: 1, voucherCode: "TEST_CODE" })).rejects.toThrow(
        /Voucher trợ lý AI Cora đã dừng hỗ trợ/,
      );
    });

    it("retains historical 'ai_subscription' in PaymentPurpose type union", () => {
      const samplePurpose: PaymentPurpose = "ai_subscription";
      expect(samplePurpose).toBe("ai_subscription");
    });
  });

  describe("Issue #326 & #331: Complete Removal of Learner AI Modules", () => {
    it("confirms course lesson create/update does not export background embedding triggers", async () => {
      const coursesModule = await import("@/lib/courses");
      expect((coursesModule as Record<string, unknown>).triggerLessonEmbeddingInBackground).toBeUndefined();
    });

    it("confirms retired learner AI client modules are completely removed from filesystem", () => {
      const retiredFiles = [
        "src/lib/flashcards.ts",
        "src/lib/learningPaths.ts",
        "src/lib/lessonSummary.ts",
        "src/lib/readinessCheck.ts",
        "src/hooks/useFlashcardDeck.ts",
        "src/hooks/useLearningPaths.ts",
        "src/hooks/useLessonSummary.ts",
        "src/hooks/useReadinessCheck.ts",
        "src/pages/learn/components/FlashcardDeckCard.tsx",
        "src/pages/learn/components/LessonReadinessCard.tsx",
        "src/pages/learn/components/LessonRecapCard.tsx",
        "src/pages/learning-path/LearningPathPage.tsx",
        "src/pages/learning-path/components/LearningPathCard.tsx",
        "public/logo/Cora_AI_Tutor.svg",
      ];

      for (const relPath of retiredFiles) {
        const fullPath = resolve(process.cwd(), relPath);
        expect(existsSync(fullPath), `Expected ${relPath} to be deleted`).toBe(false);
      }
    });
  });

  describe("Issue #327: Instructor-Facing AI Generators Preserved", () => {
    it("confirms description generator module is preserved and exports invokeGenerateDescription", async () => {
      const descModule = await import("@/lib/descriptionGenerator");
      expect(typeof descModule.invokeGenerateDescription).toBe("function");
      expect(typeof descModule.serializeGenerateDescriptionRequest).toBe("function");
    });

    it("confirms question generator module is preserved and exports invokeGenerateQuestions", async () => {
      const qModule = await import("@/lib/questionGenerator");
      expect(typeof qModule.invokeGenerateQuestions).toBe("function");
    });

    it("confirms career tracks translation payload correctly serializes careerTrackId", async () => {
      const descModule = await import("@/lib/descriptionGenerator");
      const serialized = descModule.serializeGenerateDescriptionRequest({
        action: "translate",
        type: "course",
        targetField: "description",
        locale: "en",
        sourceLocale: "vi",
        bundleKind: "course_info",
        careerTrackId: "track_test_123",
        sourceBundle: {
          title: "Khóa học AI",
          description: "Mô tả khóa học",
        },
      });
      const parsed = JSON.parse(serialized) as { careerTrackId?: string; action?: string };
      expect(parsed.careerTrackId).toBe("track_test_123");
      expect(parsed.action).toBe("translate");
    });
  });
});
