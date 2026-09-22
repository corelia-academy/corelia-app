import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { frontendTarget, FRONTEND_TARGETS } from "./worker-target.mjs";

export function entryAssetPath(html) {
  const match = html.match(/<script\b[^>]*\bsrc="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/);
  if (!match) throw new Error("Frontend entry script is missing from index.html");
  return match[1];
}

export async function verifyFrontendTarget(mode, distRoot = resolve("dist")) {
  const target = frontendTarget(mode);
  const config = JSON.parse(await readFile(resolve(distRoot, "corelia_app/wrangler.json"), "utf8"));
  if (config.name !== target.worker || config.assets?.directory !== "../client") {
    throw new Error(`Worker configuration does not target ${target.worker}`);
  }

  const html = await readFile(resolve(distRoot, "client/index.html"), "utf8");
  const assetPath = entryAssetPath(html);
  const entry = await readFile(resolve(distRoot, `client${assetPath}`), "utf8");
  const expectedUrl = `https://${target.projectRef}.supabase.co`;
  if (!entry.includes(expectedUrl) || !entry.includes(target.cdnUrl) || !entry.includes("sb_publishable_")) {
    throw new Error(`Frontend entry is missing the ${mode} Supabase, CDN, or publishable-key configuration`);
  }
  for (const [otherMode, otherTarget] of Object.entries(FRONTEND_TARGETS)) {
    if (otherMode !== mode && entry.includes(otherTarget.projectRef)) {
      throw new Error(`Frontend entry contains the ${otherMode} Supabase project ref`);
    }
  }
  return { target, assetPath };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  verifyFrontendTarget(process.argv[2])
    .then(({ target, assetPath }) => process.stdout.write(`Verified ${target.worker}: ${assetPath}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
