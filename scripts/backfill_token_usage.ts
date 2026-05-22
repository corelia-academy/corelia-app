/**
 * Backfill ai_usage_monthly.tokens_used from ai_conversations.tokens_used.
 *
 * Run ONCE on staging, then prod:
 *   deno run --allow-env --allow-net scripts/backfill_token_usage.ts
 *
 * Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  Deno.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Rows with no token data yet but have messages
const { data: rows, error: fetchError } = await db
  .from("ai_usage_monthly")
  .select("id,user_id,month,message_count,tokens_used")
  .eq("tokens_used", 0)
  .gt("message_count", 0);

if (fetchError) {
  console.error("Failed to fetch rows:", fetchError.message);
  Deno.exit(1);
}

console.log(`Found ${rows?.length ?? 0} rows to backfill.`);

let actualCount = 0;
let estimatedCount = 0;
let errorCount = 0;

for (const row of rows ?? []) {
  const monthStart = `${row.month}-01`;
  // month + 1 for end boundary
  const [year, month] = row.month.split("-").map(Number);
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: convRows, error: convError } = await db
    .from("ai_conversations")
    .select("tokens_used")
    .eq("user_id", row.user_id)
    .gte("created_at", `${monthStart}T00:00:00.000Z`)
    .lt("created_at", `${nextMonth}T00:00:00.000Z`);

  if (convError) {
    console.error(`Error fetching conversations for ${row.user_id} / ${row.month}:`, convError.message);
    errorCount++;
    continue;
  }

  const sumFromConversations = (convRows ?? []).reduce(
    (acc, r) => acc + Number(r.tokens_used ?? 0),
    0,
  );

  const tokensUsed = sumFromConversations > 0
    ? sumFromConversations
    : row.message_count * 2000; // estimated fallback

  const isEstimated = sumFromConversations === 0;

  const { error: updateError } = await db
    .from("ai_usage_monthly")
    .update({ tokens_used: tokensUsed })
    .eq("id", row.id);

  if (updateError) {
    console.error(`Failed to update ${row.id}:`, updateError.message);
    errorCount++;
    continue;
  }

  if (isEstimated) {
    estimatedCount++;
  } else {
    actualCount++;
  }
}

console.log(`Done. actual=${actualCount} estimated=${estimatedCount} errors=${errorCount}`);
