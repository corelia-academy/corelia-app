import { describe, expect, it } from "vitest";

import { getAuthErrorInfo } from "./loginErrors";

const authError = (message: string, code?: string, status = 422) => ({ __isAuthError: true, message, code, status });

describe("getAuthErrorInfo", () => {
  it("explains a reused password instead of a generic service error", () => {
    const translate = (key: string) => (key === "errors.auth__same-password" ? "Mật khẩu mới phải khác mật khẩu cũ." : "");
    const info = getAuthErrorInfo(
      authError("New password should be different from the old password.", "same_password"),
      translate,
    );
    expect(info).toEqual({ code: "auth/same-password", message: "Mật khẩu mới phải khác mật khẩu cũ." });
  });

  it("recognises the message when the API omits the code", () => {
    expect(getAuthErrorInfo(authError("New password should be different from the old password.")).code)
      .toBe("auth/same-password");
  });
});
