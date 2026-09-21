import { describe, expect, it } from "vitest";
import { readAccountConnectionError } from "./accountConnectionCallback";

describe("account connection callback", () => {
  it("reports exchange failures without displaying server diagnostics and removes duplicate callback fields", () => {
    expect(readAccountConnectionError("?tab=profile&error=server_error&error_code=unexpected_failure&error_description=private-code", "#error=server_error&error_description=private-code&sb=")).toEqual({
      messageKey: "xp.connections.oauthFailed", search: "?tab=profile", hash: "",
    });
  });
  it("recognizes user cancellation from the fragment", () => {
    expect(readAccountConnectionError("", "#error=access_denied")?.messageKey).toBe("xp.connections.oauthCancelled");
  });
  it("preserves unrelated query and anchor", () => {
    expect(readAccountConnectionError("?error=server_error&tab=settings", "#connections")).toMatchObject({ search: "?tab=settings", hash: "#connections" });
  });
  it("leaves successful callbacks for the auth handler", () => {
    expect(readAccountConnectionError("?code=auth-code", "#access_token=token")).toBeNull();
  });
});
