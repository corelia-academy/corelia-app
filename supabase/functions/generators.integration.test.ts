import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Edge Functions Integration: generate-questions and generate-description", () => {
  let questionsHandler: ((req: Request) => Promise<Response>) | null = null;
  let descriptionHandler: ((req: Request) => Promise<Response>) | null = null;

  beforeEach(() => {
    (globalThis as unknown as {
      Deno: {
        env: { get: (k: string) => string };
        serve: (handler: (req: Request) => Promise<Response>) => void;
      };
    }).Deno = {
      env: {
        get: (k: string) => {
          if (k === "CORELIA_SUPABASE_URL" || k === "SUPABASE_URL") return "https://mock.supabase.co";
          if (k === "CORELIA_SUPABASE_SECRET_KEYS" || k === "SUPABASE_SECRET_KEYS") return "sb_secret_test_key";
          if (k === "OPENAI_API_KEY") return "mock-openai-key";
          return "";
        },
      },
      serve: (handler: (req: Request) => Promise<Response>) => {
        if (!questionsHandler) {
          questionsHandler = handler;
        } else {
          descriptionHandler = handler;
        }
      },
    };

    // Mock fetch for Supabase Auth and User Profile verification
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/auth/v1/user")) {
        const body = JSON.stringify({
          id: "inst-1",
          email_confirmed_at: "2026-08-01T00:00:00Z",
        });
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("/rest/v1/profiles")) {
        const body = JSON.stringify({
          role: "instructor",
        });
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Range": "0-0/1",
          },
        });
      }
      if (urlStr.includes("/rest/v1/courses")) {
        // Return DB error for DB injection test
        const body = JSON.stringify({ message: "Connection pool exhausted" });
        return new Response(body, {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  describe("generate-questions Edge Handler", () => {
    it("rejects non-POST methods with 405 Method Not Allowed", async () => {
      await import("./generate-questions/index");
      expect(typeof questionsHandler).toBe("function");

      const res = await questionsHandler!(new Request("http://localhost", { method: "GET" }));
      expect(res.status).toBe(405);
    });

    it("rejects missing authorization header with 401", async () => {
      await import("./generate-questions/index");
      const res = await questionsHandler!(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: "c-1", locale: "vi", count: 5 }),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("rejects malformed or non-object JSON body with 400", async () => {
      await import("./generate-questions/index");
      const res = await questionsHandler!(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify("not-an-object"),
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Payload JSON phải là một object.");
    });

    it("rejects non-integer question count with 400 Bad Request", async () => {
      await import("./generate-questions/index");
      const res = await questionsHandler!(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({ courseId: "c-1", locale: "vi", count: 3.5 }),
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain("Số lượng câu hỏi phải là số nguyên");
    });

    it("masks database failures during lookup with 500 and safe message", async () => {
      await import("./generate-questions/index");
      const res = await questionsHandler!(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({ courseId: "c-1", sectionId: "sec-1", locale: "vi", count: 5 }),
        }),
      );
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toBe("Đã xảy ra lỗi hệ thống khi xử lý yêu cầu.");
    });
  });

  describe("generate-description Edge Handler", () => {
    it("rejects non-POST methods with 405 Method Not Allowed", async () => {
      await import("./generate-description/index");
      expect(typeof descriptionHandler).toBe("function");

      const res = await descriptionHandler!(new Request("http://localhost", { method: "GET" }));
      expect(res.status).toBe(405);
    });

    it("rejects missing authorization header with 401", async () => {
      await import("./generate-description/index");
      const res = await descriptionHandler!(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: "c-1", action: "generate", type: "course" }),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("masks database failures with 500 and safe message", async () => {
      await import("./generate-description/index");
      const res = await descriptionHandler!(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            courseId: "c-1",
            action: "generate",
            type: "course",
            targetField: "description",
            locale: "vi",
          }),
        }),
      );
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toBe("Đã xảy ra lỗi hệ thống khi xử lý yêu cầu.");
    });
  });
});