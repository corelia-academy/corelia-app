import assert from "node:assert/strict";
import test from "node:test";

import { mergeJobUrls, rewriteDeploymentOrigin } from "../../jobs/generate-sitemap.mjs";

const base = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://app.corelia.academy/jobs</loc></url>
</urlset>`;

test("Jobs sitemap adds unique policy-filtered job URLs and rewrites the deployment origin", () => {
  const output = mergeJobUrls(base, "https://staging.corelia.academy", [
    { slug: "backend-engineer", updated_at: "2026-09-03T00:00:00Z" },
    { slug: "backend-engineer", updated_at: "2026-09-03T00:00:00Z" },
  ]);
  assert.match(output, /https:\/\/staging\.corelia\.academy\/jobs<\/loc>/);
  assert.equal((output.match(/\/jobs\/backend-engineer<\/loc>/g) ?? []).length, 1);
  assert.match(output, /<lastmod>2026-09-03T00:00:00\.000Z<\/lastmod>/);
});

test("Jobs build rewrites the robots sitemap URL for staging", () => {
  const output = rewriteDeploymentOrigin(
    "Sitemap: https://app.corelia.academy/sitemap.xml\n",
    "https://staging.corelia.academy/",
  );
  assert.equal(output, "Sitemap: https://staging.corelia.academy/sitemap.xml\n");
});
