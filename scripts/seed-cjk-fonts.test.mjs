import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CJK_FONTS, uploadCjkFonts } from "./seed-cjk-fonts.ts";

function createStorageClient() {
  let uploadCalls = 0;
  return {
    client: {
      storage: {
        from() {
          return {
            async upload() {
              uploadCalls++;
              return { error: null };
            },
          };
        },
      },
    },
    uploadCalls: () => uploadCalls,
  };
}

test("seed CJK fonts stops before Storage upload when SHA-256 does not match", async (t) => {
  const localDir = await mkdtemp(join(tmpdir(), "corelia-cjk-fonts-"));
  t.after(() => rm(localDir, { recursive: true, force: true }));
  await writeFile(join(localDir, CJK_FONTS[0].fileName), "incorrect font bytes");
  const { client, uploadCalls } = createStorageClient();

  await assert.rejects(uploadCjkFonts(client, localDir), /Checksum không khớp/);
  assert.equal(uploadCalls(), 0);
});

test("seed CJK fonts rejects a missing expected SHA-256 before downloading or uploading", async () => {
  const font = CJK_FONTS[1];
  const originalSha256 = font.expectedSha256;
  font.expectedSha256 = undefined;
  const { client, uploadCalls } = createStorageClient();

  try {
    await assert.rejects(uploadCjkFonts(client), /SHA-256 bắt buộc/);
    assert.equal(uploadCalls(), 0);
  } finally {
    font.expectedSha256 = originalSha256;
  }
});
