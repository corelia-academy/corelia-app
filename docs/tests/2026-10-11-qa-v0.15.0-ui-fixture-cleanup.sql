-- Dọn fixture 2026-10-11-qa-v0.15.0-ui-fixture-seed.sql (corelia-staging). Chỉ xoá theo UID a6730000-... và course qa673-*.
-- Xoá user cuối cùng; nhiều bảng con (ledger, milestone, enrollment, ví, notification...) cascade theo auth.users.
-- Sau khi chạy, truy vấn cuối phải trả toàn 0. Supabase sẽ hiện hộp thoại "Potential issue detected": chọn Run query.

delete from public.feed_milestones where actor_id::text like 'a6730000-0000-4000-8000-%';
delete from public.user_point_ledger where user_id::text like 'a6730000-0000-4000-8000-%';
delete from public.wallet_link_challenges where user_id::text like 'a6730000-0000-4000-8000-%';
delete from public.connected_wallets where user_id::text like 'a6730000-0000-4000-8000-%';
delete from public.enrollments where user_id::text like 'a6730000-0000-4000-8000-%' or course_id like 'qa673-%';
delete from public.course_section_questions where course_id like 'qa673-%';
delete from public.course_lessons where course_id like 'qa673-%';
delete from public.course_sections where course_id like 'qa673-%';
delete from public.courses where id like 'qa673-%';
delete from public.email_contacts where user_id::text like 'a6730000-0000-4000-8000-%';
delete from auth.users where id::text like 'a6730000-0000-4000-8000-%' and email like 'qa-temp-v014-x_@example.invalid';
select * from (select c.table_name||'.'||c.column_name as col, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I where %I::text like %L', c.table_name, c.column_name, 'a6730000-0000-4000-8000-%'), false, true, '')))[1]::text::int as n from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE' where c.table_schema='public' and c.data_type in ('uuid','text')) x where n>0
union all select 'courses_qa673', count(*)::int from public.courses where id like 'qa673-%'
union all select 'auth.users_x', count(*)::int from auth.users where id::text like 'a6730000-%'
union all select 'ledger_x', count(*)::int from public.user_point_ledger where user_id::text like 'a6730000-%';
