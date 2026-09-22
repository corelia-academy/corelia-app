import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FRONTEND_TARGETS = Object.freeze({
  staging: Object.freeze({
    worker: "corelia-staging",
    projectRef: "opoozbmfbezkrpzxsusx",
    cdnUrl: "https://cdn-staging.corelia.academy",
    appUrl: "https://staging.corelia.academy",
  }),
  production: Object.freeze({
    worker: "corelia-app",
    projectRef: "lawhkvyyoznwygzsycan",
    cdnUrl: "https://cdn.corelia.academy",
    appUrl: "https://app.corelia.academy",
  }),
});

export function frontendTarget(mode) {
  const target = FRONTEND_TARGETS[mode];
  if (!target) throw new Error(`Unknown frontend target: ${mode}`);
  return target;
}

export async function prepareWorkerTarget(mode, configPath) {
  const target = frontendTarget(mode);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.name !== "corelia-app" && config.name !== target.worker) {
    throw new Error(`Unexpected generated Worker name: ${config.name}`);
  }
  if (config.assets?.directory !== "../client") {
    throw new Error("Generated Worker does not point at the client assets");
  }
  config.name = target.worker;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return target;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const mode = process.argv[2];
  prepareWorkerTarget(mode, resolve("dist/corelia_app/wrangler.json"))
    .then((target) => process.stdout.write(`Prepared Worker target: ${target.worker}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
