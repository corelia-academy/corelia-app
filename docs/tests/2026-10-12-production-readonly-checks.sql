-- Kiểm tra CHỈ ĐỌC trên Production (project corelia-app, org corelia, nhánh main). Không có lệnh ghi.
-- Chạy từng khối riêng trong SQL Editor; xác nhận header là "corelia-app | main | PRODUCTION" trước khi chạy.
-- Mọi kết quả chỉ là số tổng hợp, không có thông tin cá nhân.

-- ===== Khối 1: migration, hàm, quyền (nhanh) =====
set statement_timeout = '20s';
set transaction read only;
select 'tx_read_only' k, current_setting('transaction_read_only') v
union all select 'migrations_total_and_latest', count(*)::text||' / '||max(version) from supabase_migrations.schema_migrations
union all select 'migration '||v, case when exists(select 1 from supabase_migrations.schema_migrations where version=v) then 'present' else 'MISSING' end from unnest(array['20261001070125','20261001122504','20261002071829','20261002082123','20261008055659','20261008162131']) v
union all select 'xp_quiz_passed uses passing_ratio', (pg_get_functiondef('private.xp_quiz_passed()'::regprocedure) like '%passing_ratio%')::text
union all select 'xp_quiz_passed still hardcodes 0.8', (pg_get_functiondef('private.xp_quiz_passed()'::regprocedure) like '%0.8%')::text
union all select 'feed_on_xp_awarded advisory lock', (pg_get_functiondef('private.feed_on_xp_awarded()'::regprocedure) like '%pg_advisory_xact_lock%')::text
union all select 'fn xp_unlink_wallet exists', (to_regprocedure('public.xp_unlink_wallet(text,text)') is not null)::text
union all select 'fn xp_consume_wallet_challenge exists', (to_regprocedure('public.xp_consume_wallet_challenge(uuid,uuid)') is not null)::text
union all select 'fn list_my_feed_following_profiles_v1 secdef', (select prosecdef::text from pg_proc where oid='public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer)'::regprocedure)
union all select 'rls '||c.relname, c.relrowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('connected_wallets','wallet_link_challenges','feed_milestones','user_point_ledger','xp_verified_ocid')
union all select 'client write on '||t||' (authenticated insert/update/delete)', (has_table_privilege('authenticated','public.'||t,'INSERT') or has_table_privilege('authenticated','public.'||t,'UPDATE') or has_table_privilege('authenticated','public.'||t,'DELETE'))::text from unnest(array['connected_wallets','wallet_link_challenges','feed_milestones','user_point_ledger']) t
order by 1;

-- ===== Khối 2: sức khỏe dữ liệu (số tổng hợp; có thể chậm hơn, giữ statement_timeout) =====
set statement_timeout = '20s';
set transaction read only;
select 'quiz passing attempts without quiz_passed XP (all, incl. legit exclusions)' k, count(*)::text v
from (select distinct user_id,course_id,lesson_id from public.section_question_attempts
      where lesson_id is not null and attempt_group_id is not null and group_total>=1
        and group_correct::numeric/group_total >= coalesce(passing_ratio,0.7)) a
where not exists (select 1 from public.user_point_ledger l where l.user_id=a.user_id and l.source_key='quiz_passed:'||a.course_id||':'||a.lesson_id)
union all
select 'same, restricted to enrolled non-instructor learners on published courses', count(*)::text
from (select distinct user_id,course_id,lesson_id from public.section_question_attempts
      where lesson_id is not null and attempt_group_id is not null and group_total>=1
        and group_correct::numeric/group_total >= coalesce(passing_ratio,0.7)) a
join public.courses c on c.id=a.course_id and c.published and c.archived_at is null and c.instructor_id is distinct from a.user_id
 and not (coalesce(c.data->'co_instructor_permissions','{}'::jsonb) ? a.user_id::text)
where exists (select 1 from public.enrollments e where e.user_id=a.user_id and e.course_id=a.course_id)
  and not exists (select 1 from public.user_point_ledger l where l.user_id=a.user_id and l.source_key='quiz_passed:'||a.course_id||':'||a.lesson_id)
union all
select 'quiz_passed XP rows with no passing attempt', count(*)::text
from public.user_point_ledger l
where l.source='quiz_passed' and not exists (select 1 from public.section_question_attempts a
   where a.user_id=l.user_id and l.source_key='quiz_passed:'||a.course_id||':'||a.lesson_id
     and a.group_total>=1 and a.group_correct::numeric/a.group_total >= coalesce(a.passing_ratio,0.7))
union all
select 'ocid_connected rows vs distinct entity', count(*)::text||' / '||count(distinct entity_id)::text from public.user_point_ledger where source='ocid_connected'
union all
select 'ethereum_wallet rows vs distinct entity', count(*)::text||' / '||count(distinct entity_id)::text from public.user_point_ledger where source='ethereum_wallet'
union all
select 'solana_wallet rows vs distinct entity', count(*)::text||' / '||count(distinct entity_id)::text from public.user_point_ledger where source='solana_wallet'
union all
select 'duplicate (chain,address) in connected_wallets', count(*)::text from (select chain,address from public.connected_wallets group by 1,2 having count(*)>1) d
union all
select 'project cards whose hackathon differs from project source', count(*)::text from public.feed_milestones m join public.projects p on p.id=m.project_id where m.kind='project_submitted' and p.source_id is distinct from m.hackathon_id
union all
select 'public users with >=250 XP and no xp_reached card (may predate the feature)', count(*)::text
from (select user_id from public.user_point_ledger group by 1 having sum(points)>=250) t
where private.feed_actor_public(t.user_id) and not exists (select 1 from public.feed_milestones m where m.actor_id=t.user_id and m.kind='xp_reached');
