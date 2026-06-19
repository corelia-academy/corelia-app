import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventRecord {
  id: number;
  verb: string;
  actor_id: string;
  payload: {
    like_count?: number;
    [key: string]: unknown;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Lấy 3 sự kiện hot nhất tuần (Dựa theo like_count)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: hotEvents, error: eventsError } = await supabaseClient
      .from("activity_events")
      .select("id, verb, actor_id, payload")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (eventsError) throw eventsError;

    // Sắp xếp tay theo like_count để tìm top 3 (do payload là JSONB)
    const topEvents = (hotEvents as EventRecord[])
      .sort((a, b) => (b.payload?.like_count || 0) - (a.payload?.like_count || 0))
      .slice(0, 3);

    if (topEvents.length === 0) {
      return new Response(JSON.stringify({ message: "No hot events this week." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Lấy danh sách Email của Users đã bật email_activity_digest = true
    // Sử dụng batching để lấy danh sách từ Auth & notification_preferences
    // Chú ý: Ở đây ta truy vấn danh sách UUID từ notification_preferences trước, 
    // sau đó lấy thông tin user email qua Supabase Admin API.
    const { data: prefs, error: prefsError } = await supabaseClient
      .from("notification_preferences")
      .select("user_id")
      .eq("email_activity_digest", true);

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No users to send digest to." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userIds = prefs.map((p) => p.user_id);
    const emailsToSend: string[] = [];

    // Chunks of 50 to avoid Auth Admin API limits
    for (let i = 0; i < userIds.length; i += 50) {
      const chunk = userIds.slice(i, i + 50);
      // Lấy user info
      for (const uid of chunk) {
        const { data: userData } = await supabaseClient.auth.admin.getUserById(uid);
        if (userData?.user?.email) {
          emailsToSend.push(userData.user.email);
        }
      }
    }

    // 3. Chuẩn bị nội dung Email
    const emailHtml = `
      <h1>Bản tin Corelia Nổi bật (Weekly Digest)</h1>
      <p>Dưới đây là 3 hoạt động sôi nổi nhất tuần qua:</p>
      <ul>
        ${topEvents
          .map(
            (ev) =>
              `<li>${ev.verb} - ${ev.payload?.like_count || 0} lượt thích (ID: ${ev.id})</li>`
          )
          .join("")}
      </ul>
      <p>Cảm ơn bạn đã theo dõi.</p>
    `;

    // 4. Gửi email qua Resend (Mô phỏng Bulk Send)
    // Thực tế sẽ dùng: await fetch('https://api.resend.com/emails/batch', ...)
    console.log("== [MOCK] SENDING BULK EMAILS ==");
    console.log(`Sending to ${emailsToSend.length} users.`);
    console.log("Content:", emailHtml);

    return new Response(JSON.stringify({ success: true, sentCount: emailsToSend.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing digest:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
