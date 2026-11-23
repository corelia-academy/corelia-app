-- QA staging v0.15.0 — fixture cho (1) draft preview theo vai trò (#670) và (2) hai phiên XP chồng nhau (#671).
-- Chạy trong SQL Editor của corelia-staging (opoozbmfbezkrpzxsusx). KHÔNG chạy trên Production.
-- Mỗi khối chạy riêng; luôn chạy khối DỌN + QUÉT ở cuối khi xong. Supabase có thể hiện hộp thoại "Potential issue detected": chọn Run query.

-- ===== A1. Seed hackathon draft (copy từ một hackathon sẵn có, bỏ created_by để chỉ staff thấy) =====
insert into public.hackathons
select (jsonb_populate_record(null::public.hackathons,
  to_jsonb(h) || jsonb_build_object(
    'id', gen_random_uuid()::text, 'slug', 'qa670-draft', 'status', 'draft',
    'document', (h.document - 'created_by') || jsonb_build_object('title', 'QA Draft Preview', 'slug', 'qa670-draft'))
)).*
from public.hackathons h where h.slug = 'qa-356' limit 1;
select id::text, slug, status from public.hackathons where slug = 'qa670-draft';

-- ===== B1. Seed người dùng gần mốc 250 XP (cho hai phiên chồng nhau) =====
-- Sau khối này người dùng có 245 XP (chưa qua mốc 250) và profile public student.
insert into auth.users(id, email) values ('a6750000-0000-4000-8000-000000000001', 'qa675-ev@corelia.local');
update public.profiles set profile_public = true where id = 'a6750000-0000-4000-8000-000000000001';
select private.xp_award('a6750000-0000-4000-8000-000000000001', 'github_connected', 'github_connected', 245, 'identity', 'qa675', clock_timestamp());
select 'xp', sum(points)::text from public.user_point_ledger where user_id = 'a6750000-0000-4000-8000-000000000001'
union all select 'xp_reached cards', count(*)::text from public.feed_milestones where actor_id = 'a6750000-0000-4000-8000-000000000001' and kind = 'xp_reached';

-- ===== B2. Phiên A (chạy trước), giữ khoá advisory khoảng 12 giây =====
begin;
select private.xp_award('a6750000-0000-4000-8000-000000000001', 'lesson_completed', 'lesson:qa675-A', 10, 'lesson', 'qa675-A', clock_timestamp());
select pg_sleep(12);
commit;

-- ===== B3. Phiên B (chạy ở trình duyệt khác, khoảng 3 giây sau khi A bắt đầu) =====
begin;
select private.xp_award('a6750000-0000-4000-8000-000000000001', 'lesson_completed', 'lesson:qa675-B', 10, 'lesson', 'qa675-B', clock_timestamp());
commit;

-- ===== B4. Kết quả: kỳ vọng tổng 265 XP và đúng 1 card mốc 250 =====
select 'xp', sum(points)::text from public.user_point_ledger where user_id = 'a6750000-0000-4000-8000-000000000001'
union all select 'xp_reached cards', count(*)::text from public.feed_milestones where actor_id = 'a6750000-0000-4000-8000-000000000001' and kind = 'xp_reached';

-- ===== DỌN + QUÉT (chạy khi xong) =====
delete from public.hackathons where slug = 'qa670-draft';
delete from public.feed_milestones where actor_id::text like 'a6750000-0000-4000-8000-%';
delete from public.user_point_ledger where user_id::text like 'a6750000-0000-4000-8000-%';
delete from auth.users where id::text like 'a6750000-0000-4000-8000-%';
select 'hackathons qa670', count(*)::text from public.hackathons where slug = 'qa670-draft'
union all select 'auth.users qa675', count(*)::text from auth.users where id::text like 'a6750000-%'
union all select 'profiles qa675', count(*)::text from public.profiles where id::text like 'a6750000-%'
union all select 'ledger qa675', count(*)::text from public.user_point_ledger where user_id::text like 'a6750000-%'
union all select 'milestones qa675', count(*)::text from public.feed_milestones where actor_id::text like 'a6750000-%';
