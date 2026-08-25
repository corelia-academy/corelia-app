import { describe, it, expect, vi } from "vitest";

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

describe("Wave B Retirement Contract Tests (Epic #332 / Issues #326, #327, #329)", () => {
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

  describe("Issue #326 & #327: Zero Client AI Invocations", () => {
    it("confirms course lesson create/update does not export background embedding triggers", async () => {
      const coursesModule = await import("@/lib/courses");
      expect((coursesModule as Record<string, unknown>).triggerLessonEmbeddingInBackground).toBeUndefined();
    });

    it("confirms read-only flashcard types exist without generator functions", async () => {
      const flashcardsModule = await import("@/lib/flashcards");
      expect(typeof flashcardsModule.fetchFlashcardDeck).toBe("function");
      expect(typeof flashcardsModule.applyReview).toBe("function");
      expect(typeof flashcardsModule.persistDeckCards).toBe("function");
      expect(typeof flashcardsModule.isDueToday).toBe("function");
      expect((flashcardsModule as Record<string, unknown>).invokeGenerateFlashcards).toBeUndefined();
    });

    it("confirms read-only learning paths exist without generator functions", async () => {
      const lpModule = await import("@/lib/learningPaths");
      expect(typeof lpModule.listLearningPaths).toBe("function");
      expect(typeof lpModule.deleteLearningPath).toBe("function");
      expect((lpModule as Record<string, unknown>).invokeGenerateLearningPath).toBeUndefined();
    });

    it("confirms lesson summary module exists without generator function", async () => {
      const lsModule = await import("@/lib/lessonSummary");
      expect((lsModule as Record<string, unknown>).invokeGenerateLessonSummary).toBeUndefined();
    });
  });
});
