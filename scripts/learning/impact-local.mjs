import { execFileSync } from "node:child_process";

const container = process.env.LEARNING_IMPACT_CONTAINER ?? "supabase_db_corelia-app";
if (!["supabase_db_corelia-app", "supabase_db_corelia-learning-upgrade"].includes(container)) throw new Error("Impact target must be a known local disposable container");
const query = input => execFileSync("docker", ["exec","-i",container,"psql","-U","postgres","-d","postgres","-qAt","-v","ON_ERROR_STOP=1"], {input, encoding:"utf8"});
const learning = query("BEGIN READ ONLY; SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='published'); ROLLBACK;").trim() === "t";
// Read-only report; local fixture evidence, not a claim about Production data.
const sql = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
 'report_version',2,
 'validation_available',${learning},
 'scope','${learning ? 'local_post_migration_snapshot' : 'local_pre_migration_snapshot'}',
 'lessons', (SELECT jsonb_agg(jsonb_build_object('course_id',l.course_id,'lesson_id',l.id,'published',${learning ? 'l.published' : 'true'},'archived',${learning ? 'l.archived_at IS NOT NULL' : 'false'},'issues',${learning ? 'private.learning_lesson_errors(l.id,l.data,l.course_id)' : "ARRAY[]::text[]"},'public_visible',c.published AND ${learning ? 'c.archived_at IS NULL AND l.published AND l.archived_at IS NULL' : 'true'})) FROM public.course_lessons l JOIN public.courses c ON c.id=l.course_id),
 'attribution', (SELECT jsonb_agg(jsonb_build_object('course_id',id,'instructors',data->'instructors','legacy_owner',instructor_id,'legacy_permissions',data->'co_instructor_permissions')) FROM public.courses),
 'completion', (SELECT jsonb_agg(jsonb_build_object('course_id',c.id,'all_lessons',(SELECT count(*) FROM public.course_lessons l WHERE l.course_id=c.id),'required_lessons',(SELECT count(*) FROM public.course_lessons l WHERE l.course_id=c.id AND ${learning ? 'published AND archived_at IS NULL' : 'true'}),'excluded_lessons',(SELECT count(*) FROM public.course_lessons l WHERE l.course_id=c.id AND ${learning ? '(NOT published OR archived_at IS NOT NULL)' : 'false'}),'historical_completions',(SELECT count(*) FROM public.enrollments e WHERE e.course_id=c.id AND completed_at IS NOT NULL),'historical_credentials',(SELECT count(*) FROM public.enrollments e WHERE e.course_id=c.id AND certificate_issued_at IS NOT NULL))) FROM public.courses c),
 'permissions',COALESCE((SELECT jsonb_agg(jsonb_build_object('course_id',c.id,'user_id',p.id,'role',p.role,'content',private.can_manage_course_feature(c.id,p.id,'content'),'submissions',private.can_manage_course_feature(c.id,p.id,'submissions'),'students',private.can_manage_course_feature(c.id,p.id,'students')) ORDER BY c.id,p.id) FROM public.courses c CROSS JOIN public.profiles p),'[]'::jsonb),
 'enrollment_readiness',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'course_id',e.course_id,'user_id',e.user_id,
   'completed_at',e.completed_at,'certificate_issued_at',e.certificate_issued_at,
   'required_lessons',r.data->'lesson_total','completed_required_lessons',r.data->'completed_distinct',
   'canonical_percent',CASE WHEN (r.data->>'lesson_total')::numeric>0 THEN round(100*(r.data->>'completed_distinct')::numeric/(r.data->>'lesson_total')::numeric,2) ELSE 0 END,
   'final_required',r.data->'final_assignment_required','latest_final_status',r.data->'final_submission_status',
   'eligible_now',eligibility.ready,
   'historical_completion_preserved',e.completed_at IS NOT NULL AND NOT eligibility.ready,
   'completion_sync_pending',e.completed_at IS NULL AND eligibility.ready)
   ORDER BY e.course_id,e.user_id)
 FROM public.enrollments e
 CROSS JOIN LATERAL (SELECT public.corelia_certificate_readiness(e.course_id,e.user_id) AS data) r
 CROSS JOIN LATERAL (SELECT COALESCE((r.data->>'all_lessons_complete')::boolean AND
   (NOT (r.data->>'final_assignment_required')::boolean OR r.data->>'final_submission_status'='approved'),false) AS ready) eligibility),'[]'::jsonb)
));
ROLLBACK;`;
const output = query(sql);
const report = JSON.parse(output);
for (const key of ["lessons", "attribution", "completion"]) report[key] ??= [];
report.lessons.sort((a,b) => a.course_id.localeCompare(b.course_id) || a.lesson_id.localeCompare(b.lesson_id));
for (const key of ["attribution", "completion"]) report[key].sort((a,b) => a.course_id.localeCompare(b.course_id));
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
