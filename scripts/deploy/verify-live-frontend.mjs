import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { entryAssetPath, verifyFrontendTarget } from "./verify-frontend-target.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function verifyLiveFrontend(mode, releaseSha, fetcher = fetch) {
  const { target, assetPath } = await verifyFrontendTarget(mode);
  const localAsset = await readFile(resolve("dist/client", assetPath.slice(1)));
  const expectedHash = hash(localAsset);
  let lastError;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const url = `${target.appUrl}/?release=${encodeURIComponent(releaseSha)}-${attempt}`;
      const htmlResponse = await fetcher(url, { headers: { "Cache-Control": "no-cache" } });
      if (!htmlResponse.ok) throw new Error(`HTML returned ${htmlResponse.status}`);
      const liveAssetPath = entryAssetPath(await htmlResponse.text());
      if (liveAssetPath !== assetPath) throw new Error(`HTML points to ${liveAssetPath}, expected ${assetPath}`);
      const assetResponse = await fetcher(`${target.appUrl}${assetPath}`);
      if (!assetResponse.ok) throw new Error(`entry asset returned ${assetResponse.status}`);
      if (hash(Buffer.from(await assetResponse.arrayBuffer())) !== expectedHash) {
        throw new Error("live entry asset bytes differ from the verified build");
      }
      return { target, assetPath };
    } catch (error) {
      lastError = error;
      if (attempt < 9) await new Promise((done) => setTimeout(done, 5000));
    }
  }
  throw new Error(`Live ${mode} verification failed: ${lastError.message}`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  verifyLiveFrontend(process.argv[2], process.argv[3] ?? "manual")
    .then(({ target, assetPath }) => process.stdout.write(`Verified live ${target.worker}: ${assetPath}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
