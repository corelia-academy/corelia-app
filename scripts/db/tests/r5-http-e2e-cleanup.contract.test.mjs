import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../../..");

describe("R5 HTTP E2E cleanup contract", () => {
  it("terminates the complete Edge process tree and bounds cleanup commands", () => {
    const content = fs.readFileSync(
      path.join(rootDir, "scripts/db/tests/r5-payment-http-e2e.integration.mjs"),
      "utf8",
    );

    assert.match(content, /const pnpmShell = process\.platform === "win32"/);
    assert.match(content, /shell: pnpmShell/);
    assert.match(content, /detached: process\.platform !== "win32"/);
    assert.match(content, /process\.kill\(-pid, "SIGTERM"\)/);
    assert.match(content, /process\.kill\(-pid, "SIGKILL"\)/);
    assert.match(content, /timeout: edgeProcessStopTimeoutMs/);
    assert.match(content, /timeout: dockerStopTimeoutMs/);
    assert.match(content, /timeoutMs: cleanupSqlTimeoutMs/);
    assert.match(content, /child\.stdout\?\.destroy\(\)/);
    assert.match(content, /child\.stderr\?\.destroy\(\)/);
  });

  it("does not wrap the local integration suite in an extra shell", () => {
    const content = fs.readFileSync(
      path.join(rootDir, "scripts/db/verify-local-migration-apply.mjs"),
      "utf8",
    );

    assert.match(content, /const pnpmShell = process\.platform === "win32"/);
    assert.match(content, /shell: pnpmShell/);
    assert.doesNotMatch(content, /shell: true/);
    assert.match(content, /execFileSync\("node", \[r5PaymentHttpE2ePath\], \{ stdio: "inherit", shell: false \}\)/);
  });
});
