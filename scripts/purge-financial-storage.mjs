import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = client.storage.from("app");
const roots = ["course-partner-docs", "instructor-partner-docs"];

async function collect(prefix) {
  const paths = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    if (!data?.length) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) paths.push(path);
      else paths.push(...await collect(path));
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return paths;
}

for (const root of roots) {
  const paths = await collect(root);
  for (let index = 0; index < paths.length; index += 1000) {
    const { error } = await bucket.remove(paths.slice(index, index + 1000));
    if (error) throw error;
  }
  const remaining = await collect(root);
  if (remaining.length) throw new Error(`${root}: ${remaining.length} objects remain`);
  console.log(`${root}: removed ${paths.length} objects`);
}
