import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase.ts", () => ({
  verifyBearerUser: async (req: Request, db: VoucherTestDb) => {
    const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!header) throw new Error("Missing Authorization header");
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new Error("Invalid Authorization header");
    const { data, error } = await db.auth.getUser(match[1]!);
    if (error || !data.user) throw new Error("Invalid or expired session");
    return data.user;
  },
}));

import {
  handleAiVoucherBatchCreate,
  handleAiVoucherBatchDelete,
  handleAiVoucherPreview,
} from "./handlers.ts";

type VoucherTestDb = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

const RETIRED_CASES = [
  {
    op: "payments.ai.voucher.preview",
    handler: handleAiVoucherPreview,
    expectedMessage: "Voucher AI dành cho người học đã dừng hỗ trợ.",
  },
  {
    op: "payments.ai.vouchers.batchCreate",
    handler: handleAiVoucherBatchCreate,
    expectedMessage: "Tạo voucher AI đã dừng hỗ trợ.",
  },
  {
    op: "payments.ai.vouchers.batchDelete",
    handler: handleAiVoucherBatchDelete,
    expectedMessage: "Xóa voucher AI đã dừng hỗ trợ; dữ liệu lịch sử được giữ nguyên.",
  },
] as const;

function requestFor(op: string, authenticated: boolean): Request {
  return new Request(`http://localhost/functions/v1/corelia-api?op=${op}`, {
    method: "POST",
    headers: authenticated ? { Authorization: "Bearer valid-user-token" } : undefined,
  });
}

function guardedDb(): VoucherTestDb {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-a" } },
        error: null,
      }),
    },
    from: vi.fn(() => {
      throw new Error("retired voucher handler attempted a table query or mutation");
    }),
    rpc: vi.fn(() => {
      throw new Error("retired voucher handler attempted an RPC query or mutation");
    }),
  };
}

describe("retired AI voucher handlers", () => {
  for (const testCase of RETIRED_CASES) {
    describe(testCase.op, () => {
      it("rejects unauthenticated requests without touching the database", async () => {
        const db = guardedDb();

        const response = await testCase.handler(requestFor(testCase.op, false), db as never);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ message: "Chưa đăng nhập" });
        expect(db.auth.getUser).not.toHaveBeenCalled();
        expect(db.from).not.toHaveBeenCalled();
        expect(db.rpc).not.toHaveBeenCalled();
      });

      it("fails closed for authenticated users without querying or mutating voucher data", async () => {
        const db = guardedDb();

        const response = await testCase.handler(requestFor(testCase.op, true), db as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ message: testCase.expectedMessage });
        expect(db.auth.getUser).toHaveBeenCalledOnce();
        expect(db.auth.getUser).toHaveBeenCalledWith("valid-user-token");
        expect(db.from).not.toHaveBeenCalled();
        expect(db.rpc).not.toHaveBeenCalled();
      });
    });
  }
});

describe("retired AI voucher routes", () => {
  it("routes each protected POST operation to its retired handler", () => {
    const routerPath = fileURLToPath(new URL("../index.ts", import.meta.url));
    const router = readFileSync(routerPath, "utf8");

    const expectedBindings = [
      ["payments.ai.voucher.preview", "handleAiVoucherPreview"],
      ["payments.ai.vouchers.batchCreate", "handleAiVoucherBatchCreate"],
      ["payments.ai.vouchers.batchDelete", "handleAiVoucherBatchDelete"],
    ] as const;

    for (const [op, handlerName] of expectedBindings) {
      expect(router).toContain(`"${op}"`);
      expect(router).toMatch(
        new RegExp(
          `op\\s*===\\s*["']${op.replaceAll(".", "\\.")}["'][\\s\\S]{0,160}` +
            `req\\.method\\s*===\\s*["']POST["'][\\s\\S]{0,160}${handlerName}\\(req, db\\)`,
        ),
      );
    }
  });
});
