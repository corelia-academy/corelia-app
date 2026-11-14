-- Dev-only browser fixture. The runner pins this file to the empty
-- supabase_db_studio-manual-order-clone database; never run it on a human DB.
BEGIN;

CREATE TEMP TABLE studio_ui_fixture_runs (
  case_key text PRIMARY KEY,
  course_id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  previous_run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_job_id uuid
);
INSERT INTO studio_ui_fixture_runs (case_key, catalog_job_id)
SELECT case_key,
  CASE WHEN case_key LIKE 'source_%' THEN gen_random_uuid() END
FROM unnest(ARRAY[
  'source_started', 'source_reused', 'source_attached', 'source_kept', 'source_no_event',
  'resumed_lessons', 'review_checks', 'paused_run', 'malformed_draft', 'needs_fix_lesson'
]) AS case_key;

CREATE TEMP TABLE studio_ui_fixture_path (path_id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO studio_ui_fixture_path DEFAULT VALUES;

INSERT INTO public.studio_paths (id, group_kind, slug, title)
SELECT path_id, 'skill', 'studio-ui-fixture-' || :'fixture_key', 'Fixture skill path'
FROM studio_ui_fixture_path;

INSERT INTO public.studio_courses (id, title, level, status, research_status)
SELECT course_id,
       '__studio_ui_fixture__:' || :'fixture_key' || ':' || case_key,
       'beginner', 'generating',
       CASE WHEN case_key IN ('source_reused', 'source_kept', 'source_no_event') THEN 'evidence_ok' ELSE 'idea' END
FROM studio_ui_fixture_runs;

INSERT INTO public.studio_course_paths (course_id, path_id)
SELECT r.course_id, p.path_id
FROM studio_ui_fixture_runs r CROSS JOIN studio_ui_fixture_path p;

INSERT INTO public.studio_catalog_jobs (id, course_id, trigger, status, started_at, finished_at)
SELECT r.catalog_job_id, r.course_id, 'manual',
       CASE WHEN r.case_key IN ('source_started', 'source_attached') THEN 'running' ELSE 'evidence_ok' END,
       CASE r.case_key
         WHEN 'source_started' THEN now() - interval '2 minutes'
         WHEN 'source_attached' THEN now() - interval '35 minutes'
         WHEN 'source_reused' THEN now() - interval '1 day 10 minutes'
         WHEN 'source_kept' THEN now() - interval '60 days'
         ELSE now() - interval '45 days'
       END,
       CASE WHEN r.case_key IN ('source_started', 'source_attached') THEN NULL
            WHEN r.case_key = 'source_reused' THEN now() - interval '1 day'
            WHEN r.case_key = 'source_kept' THEN now() - interval '59 days'
            ELSE now() - interval '44 days'
       END
FROM studio_ui_fixture_runs r
WHERE r.catalog_job_id IS NOT NULL;

CREATE TEMP TABLE studio_ui_fixture_sample_job (
  job_id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL
);
INSERT INTO studio_ui_fixture_sample_job (course_id)
SELECT course_id FROM studio_ui_fixture_runs WHERE case_key = 'source_started';
INSERT INTO public.studio_catalog_jobs (id, course_id, trigger, status, started_at, finished_at)
SELECT job_id, course_id, 'manual', 'evidence_ok', now() - interval '10 days', now() - interval '10 days' + interval '1 minute'
FROM studio_ui_fixture_sample_job;

INSERT INTO public.studio_runs (id, course_id, status, started_at, catalog_job_id, paused_at)
SELECT r.run_id, r.course_id, 'running',
       CASE r.case_key
         WHEN 'source_started' THEN now() - interval '1 minute'
         WHEN 'source_attached' THEN now() - interval '5 minutes'
         WHEN 'source_reused' THEN now() - interval '30 minutes'
         WHEN 'source_kept' THEN now() - interval '20 minutes'
         WHEN 'source_no_event' THEN now() - interval '15 minutes'
         WHEN 'resumed_lessons' THEN now() - interval '1 hour'
         WHEN 'review_checks' THEN now() - interval '2 hours'
         WHEN 'malformed_draft' THEN now() - interval '10 minutes'
         ELSE now() - interval '20 minutes'
       END,
       CASE WHEN r.case_key LIKE 'source_%' THEN r.catalog_job_id END,
       CASE WHEN r.case_key = 'paused_run' THEN now() - interval '5 minutes' END
FROM studio_ui_fixture_runs r;

INSERT INTO public.studio_run_steps (run_id, step_key, state)
SELECT r.run_id, step.step_key,
       CASE
         WHEN r.case_key = 'source_started' AND step.step_key = 'catalog_research' THEN 'active'
         WHEN r.case_key = 'source_attached' AND step.step_key = 'catalog_research' THEN 'active'
         WHEN r.case_key IN ('source_reused', 'source_kept', 'source_no_event') AND step.step_key = 'catalog_research' THEN 'done'
         WHEN r.case_key = 'resumed_lessons' AND step.step_key IN ('catalog_research', 'brief', 'research', 'curriculum', 'curriculum_review', 'lessons') THEN 'done'
         WHEN r.case_key = 'resumed_lessons' AND step.step_key = 'lesson_review' THEN 'active'
         WHEN r.case_key = 'review_checks' AND step.step_key <> 'publish' THEN 'done'
         WHEN r.case_key = 'review_checks' AND step.step_key = 'publish' THEN 'active'
         WHEN r.case_key = 'paused_run' AND step.step_key = 'catalog_research' THEN 'done'
         WHEN r.case_key = 'paused_run' AND step.step_key = 'brief' THEN 'active'
         WHEN r.case_key = 'malformed_draft' AND step.step_key IN ('catalog_research', 'brief', 'research', 'curriculum') THEN 'done'
         WHEN r.case_key = 'malformed_draft' AND step.step_key = 'lessons' THEN 'active'
         WHEN r.case_key = 'needs_fix_lesson' AND step.step_key IN ('catalog_research', 'brief', 'research', 'curriculum', 'lessons') THEN 'done'
         WHEN r.case_key = 'needs_fix_lesson' AND step.step_key = 'lesson_review' THEN 'active'
         ELSE 'pending'
       END
FROM studio_ui_fixture_runs r
CROSS JOIN unnest(ARRAY[
  'catalog_research', 'brief', 'research', 'curriculum', 'curriculum_review',
  'lessons', 'lesson_review', 'structure_check', 'journey_test', 'publish'
]::text[]) AS step(step_key);

-- The four recorded provenance cases. The legacy case intentionally has no source event.
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'catalog_research', 0, 'progress', 'A1',
       CASE r.case_key
         WHEN 'source_started' THEN 'Bắt đầu nghiên cứu mới cho khóa fixture.'
         WHEN 'source_reused' THEN 'Dùng lại kết quả nghiên cứu còn hiệu lực; không gọi model.'
         WHEN 'source_attached' THEN 'Gắn vào job nghiên cứu đang chạy.'
         ELSE 'Giữ nguyên kết quả nghiên cứu của lượt trước.'
       END,
       jsonb_build_object(
         'source', CASE r.case_key
           WHEN 'source_started' THEN 'started'
           WHEN 'source_reused' THEN 'reused'
           WHEN 'source_attached' THEN 'attached_running'
           ELSE 'kept_previous'
         END,
         'job_id', j.id,
         'started_at', to_char(j.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
         'finished_at', CASE WHEN j.finished_at IS NULL THEN NULL ELSE to_char(j.finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
         'expires_at', CASE WHEN j.finished_at IS NULL THEN NULL ELSE to_char((j.finished_at + interval '20 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
         'period_days', 20
       ), now()
FROM studio_ui_fixture_runs r
JOIN public.studio_catalog_jobs j ON j.id = r.catalog_job_id
WHERE r.case_key IN ('source_started', 'source_reused', 'source_attached', 'source_kept');

-- Five completed A1 duration samples, a prior failed attempt, and current submitted requests.
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output, usage,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT NULL, NULL, NULL, sample.catalog_job_id, sample.attempt, 'A1', 'research', 'ai',
       'openai', 'fixture-research', CASE WHEN sample.status = 'completed' THEN 'fixture-result' END,
       'fixture-v1', '{}'::jsonb, '{"groups":[]}'::jsonb,
       CASE WHEN sample.status = 'completed' THEN '{"shared":[],"by_group":[],"web_evidence":[],"input_evidence":[]}'::jsonb END,
       CASE WHEN sample.status = 'completed' THEN '{"input_tokens":1,"output_tokens":1}'::jsonb END,
       sample.status, 'fixture-' || :'fixture_key' || '-' || sample.request_key,
       sample.created_at, sample.submitted_at, sample.completed_at
FROM (
  SELECT r.catalog_job_id, 1 AS attempt, 'submitted'::text AS status, 'started-current'::text AS request_key,
         now() - interval '3 minutes' AS created_at, now() - interval '2 minutes' AS submitted_at, NULL::timestamptz AS completed_at
  FROM studio_ui_fixture_runs r WHERE r.case_key = 'source_started'
  UNION ALL
  SELECT r.catalog_job_id, 0, 'submitted', 'attached-current', now() - interval '10 minutes', now() - interval '8 minutes', NULL::timestamptz
  FROM studio_ui_fixture_runs r WHERE r.case_key = 'source_attached'
  UNION ALL
  SELECT r.catalog_job_id, 0, 'completed', 'reused-sample', now() - interval '28 minutes', now() - interval '28 minutes', now() - interval '20 minutes'
  FROM studio_ui_fixture_runs r WHERE r.case_key = 'source_reused'
  UNION ALL
  SELECT r.catalog_job_id, 0, 'completed', 'kept-sample', now() - interval '80 minutes', now() - interval '80 minutes', now() - interval '68 minutes'
  FROM studio_ui_fixture_runs r WHERE r.case_key = 'source_kept'
  UNION ALL
  SELECT r.catalog_job_id, 0, 'completed', 'legacy-sample', now() - interval '32 minutes', now() - interval '32 minutes', now() - interval '26 minutes'
  FROM studio_ui_fixture_runs r WHERE r.case_key = 'source_no_event'
  UNION ALL
  SELECT s.job_id, 0, 'completed', 'extra-sample', now() - interval '59 minutes', now() - interval '59 minutes', now() - interval '50 minutes'
  FROM studio_ui_fixture_sample_job s
  UNION ALL
  SELECT s.job_id, 1, 'completed', 'extra-sample-2', now() - interval '49 minutes', now() - interval '49 minutes', now() - interval '40 minutes'
  FROM studio_ui_fixture_sample_job s
) AS sample;

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, prompt_version, params, input, status, failure_kind,
  provider_request_id, error, created_at, submitted_at, completed_at
)
SELECT NULL, NULL, NULL, r.catalog_job_id, 0, 'A1', 'research', 'ai',
       'openai', 'fixture-research', 'fixture-v1', '{}'::jsonb, '{"groups":[]}'::jsonb,
       'failed', 'provider', 'fixture-' || :'fixture_key' || '-started-previous', 'Fixture provider retry.',
       now() - interval '4 minutes', now() - interval '3 minutes 30 seconds', now() - interval '3 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'source_started';

-- Resumed run: curriculum generation resumed without run events; lesson generation has schema-conforming LessonBlockOutput.
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'curriculum', NULL, NULL, 0, 'A3', 'text', 'resumed',
       'openai', 'fixture-curriculum', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       '{"modules":[{"id":"fixture-module","title":"Fixture module","lessons":[{"id":"fixture-lesson-alpha","title":"Fixture lesson alpha","format":"article"}]}],"outcomes":[{"id":"fixture-outcome","text":"Fixture outcome"}]}'::jsonb,
       'completed', 'fixture-' || :'fixture_key' || '-resumed-curriculum', now() - interval '1 hour', now() - interval '59 minutes', now() - interval '58 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'resumed_lessons';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lessons', 'fixture-lesson-alpha', NULL, 0, 'A5', 'text', 'resumed',
       'anthropic', 'fixture-lesson', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       jsonb_build_object(
         'title', 'Fixture lesson alpha',
         'short_description', 'Bài học mẫu chép từ lượt trước.',
         'duration_seconds', 300,
         'resources', jsonb_build_array(jsonb_build_object('title', 'Tài liệu chuẩn', 'url', 'https://example.com/docs')),
         'suggested_videos', '[]'::jsonb,
         'source_ids', jsonb_build_array('s1'),
         'summary', 'Bài học đã hoàn thành từ lượt chạy trước.',
         'article', jsonb_build_object(
           'description_markdown', '## Giới thiệu' || E'\n\n' || 'Nội dung bài viết mẫu từ lượt chạy trước.',
           'diagrams', '[]'::jsonb
         ),
         'quiz', NULL,
         'code', NULL,
         'practice', NULL,
         'video', NULL
       ),
       'completed', 'fixture-' || :'fixture_key' || '-resumed-lesson-alpha', now() - interval '57 minutes', now() - interval '56 minutes', now() - interval '55 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'resumed_lessons';

INSERT INTO public.studio_runs (id, course_id, status, hold_reason, started_at, finished_at)
SELECT previous_run_id, course_id, 'draft_failed', 'Fixture prior run', now() - interval '3 hours', now() - interval '70 minutes'
FROM studio_ui_fixture_runs WHERE case_key = 'resumed_lessons';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, step.step_key, 0, 'result', step.agent_role,
       'Dùng lại từ lượt trước: 1 lesson đã đạt, 0 bản nháp chờ review.',
       jsonb_build_object('source', 'resumed', 'from_run_id', r.previous_run_id, 'step', step.step_key,
         'attempt', 0, 'finished_at', to_char((now() - interval '1 hour') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
         'completed_lessons', 1, 'pending_review_drafts', 0),
       now() - interval '55 minutes'
FROM studio_ui_fixture_runs r
CROSS JOIN (VALUES ('lessons'::text, 'A5'::text), ('lesson_review'::text, 'A6'::text)) AS step(step_key, agent_role)
WHERE r.case_key = 'resumed_lessons';

-- ============================================================================
-- 27-lesson fixture for H-1 (compact activity log) and H-2 (passing reasons in steps 8-9)
-- ============================================================================
CREATE TEMP TABLE studio_ui_fixture_lessons (
  idx int PRIMARY KEY,
  lesson_id text NOT NULL,
  lesson_title text NOT NULL,
  format text NOT NULL,
  module_id text NOT NULL,
  output jsonb NOT NULL
);

INSERT INTO studio_ui_fixture_lessons (idx, lesson_id, lesson_title, format, module_id, output)
SELECT
  i AS idx,
  'fixture-lesson-' || to_char(i, 'FM00') AS lesson_id,
  'Bài học ' || i || ': ' || CASE (i % 5)
    WHEN 1 THEN 'Tổng quan và cú pháp ' || i
    WHEN 2 THEN 'Thực hành viết mã ' || i
    WHEN 3 THEN 'Trắc nghiệm đánh giá ' || i
    WHEN 4 THEN 'Thực hành độc lập ' || i
    ELSE 'Video hướng dẫn ' || i
  END AS lesson_title,
  CASE (i % 5)
    WHEN 1 THEN 'article'
    WHEN 2 THEN 'code'
    WHEN 3 THEN 'quiz'
    WHEN 4 THEN 'practice'
    ELSE 'video'
  END AS format,
  CASE
    WHEN i <= 9 THEN 'module-1'
    WHEN i <= 18 THEN 'module-2'
    ELSE 'module-3'
  END AS module_id,
  jsonb_build_object(
    'title', 'Bài học ' || i || ': ' || CASE (i % 5)
      WHEN 1 THEN 'Tổng quan và cú pháp ' || i
      WHEN 2 THEN 'Thực hành viết mã ' || i
      WHEN 3 THEN 'Trắc nghiệm đánh giá ' || i
      WHEN 4 THEN 'Thực hành độc lập ' || i
      ELSE 'Video hướng dẫn ' || i
    END,
    'short_description', 'Mô tả chi tiết và mục tiêu cần đạt của bài học ' || i || '.',
    'duration_seconds', 300 + i * 15,
    'resources', jsonb_build_array(
      jsonb_build_object('title', 'Tài liệu chuẩn ' || i, 'url', 'https://example.com/docs/' || i)
    ),
    'suggested_videos', '[]'::jsonb,
    'source_ids', jsonb_build_array('s1', 's2'),
    'summary', 'Tóm tắt bài học ' || i || ' về các nội dung trọng tâm.',
    'article', CASE WHEN (i % 5) = 1 THEN jsonb_build_object(
      'description_markdown', '## Nội dung bài viết ' || i || E'\n\n' || 'Phân tích chi tiết và các ví dụ minh họa trực quan.',
      'diagrams', '[]'::jsonb
    ) ELSE NULL END,
    'code', CASE WHEN (i % 5) = 2 THEN jsonb_build_object(
      'instructions', 'Hoàn thành hàm xử lý dữ liệu cho bài học ' || i || '.',
      'language', 'rust',
      'file_path', 'src/exercise_' || i || '.rs',
      'starter_source', 'pub fn solve_' || i || '(x: i32) -> i32 { 0 }',
      'reference_solution', 'pub fn solve_' || i || '(x: i32) -> i32 { x * 2 }',
      'hints', jsonb_build_array('Nhân đôi giá trị đầu vào x * 2'),
      'mode', 'edit',
      'blanks', '[]'::jsonb,
      'tests', jsonb_build_array(
        jsonb_build_object(
          'id', 'test_eval_' || i,
          'type', 'contains',
          'description', 'Kiểm tra xử lý logic',
          'required', true,
          'value', 'x * 2',
          'accepted_sources', '[]'::jsonb,
          'failure_message', 'Chưa đúng biểu thức',
          'hint', 'Thực hiện x * 2'
        )
      )
    ) ELSE NULL END,
    'quiz', CASE WHEN (i % 5) = 3 THEN jsonb_build_object(
      'questions', jsonb_build_array(
        jsonb_build_object(
          'question', 'Khái niệm nào là trọng tâm của bài ' || i || '?',
          'options', jsonb_build_array(
            jsonb_build_object('id', 'a', 'text', 'Phương án A'),
            jsonb_build_object('id', 'b', 'text', 'Phương án B'),
            jsonb_build_object('id', 'c', 'text', 'Phương án C')
          ),
          'correct_index', 1,
          'explanation', 'Phương án B đúng theo quy chuẩn kỹ thuật.'
        )
      )
    ) ELSE NULL END,
    'practice', CASE WHEN (i % 5) = 4 THEN jsonb_build_object(
      'mode', 'checklist',
      'description_markdown', 'Thực hiện danh mục kiểm tra bài ' || i || ':',
      'checklist_items', jsonb_build_array(
        jsonb_build_object('id', 'chk1', 'label', 'Chuẩn bị môi trường thử nghiệm'),
        jsonb_build_object('id', 'chk2', 'label', 'Xác thực kết quả thực thi')
      )
    ) ELSE NULL END,
    'video', CASE WHEN (i % 5) = 0 THEN jsonb_build_object(
      'youtube_url', 'https://youtu.be/dQw4w9WgXcQ',
      'start_seconds', 0,
      'end_seconds', 180
    ) ELSE NULL END
  )
FROM generate_series(1, 27) AS i;

-- Curriculum generation with 27 lessons distributed across 3 modules
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'curriculum', NULL, NULL, 0, 'A3', 'text', 'ai',
       'openai', 'fixture-curriculum', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       jsonb_build_object(
         'outcomes', jsonb_build_array(
           jsonb_build_object('id', 'fixture-outcome-1', 'text', 'Nắm vững kiến thức nền tảng và cú pháp'),
           jsonb_build_object('id', 'fixture-outcome-2', 'text', 'Áp dụng cấu trúc dữ liệu và xử lý lỗi'),
           jsonb_build_object('id', 'fixture-outcome-3', 'text', 'Xây dựng và kiểm thử dự án hoàn chỉnh')
         ),
         'modules', jsonb_build_array(
           jsonb_build_object('id', 'module-1', 'title', 'Module 1: Nền tảng', 'description', '9 bài học khởi đầu',
             'lessons', (SELECT jsonb_agg(jsonb_build_object('id', l.lesson_id, 'title', l.lesson_title, 'format', l.format)) FROM studio_ui_fixture_lessons l WHERE l.module_id = 'module-1')
           ),
           jsonb_build_object('id', 'module-2', 'title', 'Module 2: Xử lý dữ liệu', 'description', '9 bài học chuyên sâu',
             'lessons', (SELECT jsonb_agg(jsonb_build_object('id', l.lesson_id, 'title', l.lesson_title, 'format', l.format)) FROM studio_ui_fixture_lessons l WHERE l.module_id = 'module-2')
           ),
           jsonb_build_object('id', 'module-3', 'title', 'Module 3: Dự án thực tế', 'description', '9 bài học dự án',
             'lessons', (SELECT jsonb_agg(jsonb_build_object('id', l.lesson_id, 'title', l.lesson_title, 'format', l.format)) FROM studio_ui_fixture_lessons l WHERE l.module_id = 'module-3')
           )
         )
       ),
       'completed', 'fixture-' || :'fixture_key' || '-review-curriculum', now() - interval '2 hours', now() - interval '119 minutes', now() - interval '118 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Step 5: Curriculum review generations (attempt 0 legacy without checks, attempt 1 with checks)
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'curriculum_review', NULL, NULL, 0, 'A4', 'review', 'ai',
       'anthropic', 'fixture-review', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       '{"verdict":"pass","summary":"Legacy fixture review","issues":[]}'::jsonb,
       'completed', 'fixture-' || :'fixture_key' || '-review-a4-legacy', now() - interval '116 minutes', now() - interval '115 minutes', now() - interval '114 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'curriculum_review', NULL, NULL, 1, 'A4', 'review', 'ai',
       'anthropic', 'fixture-review', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       '{"verdict":"pass","summary":"Fixture review","issues":[],"checks":[{"criterion":"outcome_coverage","result":"ok","basis":"Each outcome has a lesson.","refs":["fixture-outcome-1"],"verified_by":"reasoning"}]}'::jsonb,
       'completed', 'fixture-' || :'fixture_key' || '-review-a4', now() - interval '110 minutes', now() - interval '109 minutes', now() - interval '108 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Step 6: 27 lesson generations completed at attempt 0, and 3 lessons revised at attempt 1 (idx 3, 7, 12)
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lessons', l.lesson_id, NULL, 0, 'A5', 'text', 'ai',
       'anthropic', 'fixture-lesson', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       l.output,
       'completed', 'fixture-' || :'fixture_key' || '-lesson-' || l.lesson_id, now() - interval '100 minutes', now() - interval '99 minutes', now() - interval '98 minutes'
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lessons', l.lesson_id, NULL, 1, 'A5', 'text', 'ai',
       'anthropic', 'fixture-lesson', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       l.output,
       'completed', 'fixture-' || :'fixture_key' || '-lesson-retry-' || l.lesson_id, now() - interval '95 minutes', now() - interval '94 minutes', now() - interval '93 minutes'
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks' AND l.idx IN (3, 7, 12);

-- Step 7: 27 lesson_review generations completed at attempt 0, and 3 lessons reviewed at attempt 1
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lesson_review', l.lesson_id, NULL, 0, 'A6', 'review', 'ai',
       'anthropic', 'fixture-review', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       CASE WHEN l.idx IN (3, 7, 12) THEN
         jsonb_build_object(
           'verdict', 'needs_fix',
           'summary', 'Cần sửa lỗi blocking cho ' || l.lesson_title,
           'issues', jsonb_build_array(
             jsonb_build_object(
               'location', 'lesson.description_markdown',
               'problem', 'Khái niệm chưa chuẩn xác theo tài liệu nguồn',
               'fix', 'Sửa lại định nghĩa thuật ngữ',
               'criterion', 'factual_accuracy_by_sources',
               'category', 'wrong_facts_or_definitions',
               'severity', 'blocking',
               'verified_by', 'source'
             )
           ),
           'checks', jsonb_build_array(
             jsonb_build_object('criterion', 'outcome_coverage', 'result', 'ok', 'basis', 'Đầy đủ mục tiêu', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'factual_accuracy_by_sources', 'result', 'issue', 'basis', 'Sai lệch định nghĩa', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             jsonb_build_object('criterion', 'supported_platform_formats', 'result', 'ok', 'basis', 'Đúng định dạng', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'no_submissions', 'result', 'ok', 'basis', 'Không nộp bài', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'tool_versions', 'result', 'ok', 'basis', 'Phiên bản chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Đúng trình tự', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             jsonb_build_object('criterion', 'outcome_and_level_fit', 'result', 'ok', 'basis', 'Phù hợp trình độ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
           )
         )
       ELSE
         jsonb_build_object(
           'verdict', 'pass',
           'summary', 'Đạt yêu cầu review cho ' || l.lesson_title,
           'issues', '[]'::jsonb,
           'checks', jsonb_build_array(
             jsonb_build_object('criterion', 'outcome_coverage', 'result', 'ok', 'basis', 'Đầy đủ mục tiêu', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'factual_accuracy_by_sources', 'result', 'ok', 'basis', 'Nội dung chuẩn xác', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             jsonb_build_object('criterion', 'supported_platform_formats', 'result', 'ok', 'basis', 'Đúng định dạng', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'no_submissions', 'result', 'ok', 'basis', 'Không nộp bài', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'tool_versions', 'result', 'ok', 'basis', 'Phiên bản chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Khớp lộ trình', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             CASE WHEN l.idx = 1 THEN
               jsonb_build_object('criterion', 'quiz_answers', 'result', 'unverified', 'basis', 'Chưa kiểm chứng bằng công cụ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
             ELSE
               jsonb_build_object('criterion', 'outcome_and_level_fit', 'result', 'ok', 'basis', 'Phù hợp trình độ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
             END
           )
         )
       END,
       'completed', 'fixture-' || :'fixture_key' || '-review-' || l.lesson_id, now() - interval '90 minutes', now() - interval '89 minutes', now() - interval '88 minutes'
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lesson_review', l.lesson_id, NULL, 1, 'A6', 'review', 'ai',
       'anthropic', 'fixture-review', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       jsonb_build_object(
         'verdict', 'pass', 'summary', 'Đạt sau vòng sửa cho ' || l.lesson_title, 'issues', '[]'::jsonb,
         'checks', jsonb_build_array(
           jsonb_build_object('criterion', 'outcome_coverage', 'result', 'ok', 'basis', 'Đầy đủ mục tiêu', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'factual_accuracy_by_sources', 'result', 'ok', 'basis', 'Đã sửa chính xác', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
           jsonb_build_object('criterion', 'supported_platform_formats', 'result', 'ok', 'basis', 'Đúng định dạng', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'no_submissions', 'result', 'ok', 'basis', 'Không nộp bài', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'tool_versions', 'result', 'ok', 'basis', 'Phiên bản chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Đã hiệu chỉnh đạt yêu cầu.', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
           jsonb_build_object('criterion', 'outcome_and_level_fit', 'result', 'ok', 'basis', 'Phù hợp trình độ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
         )
       ),
       'completed', 'fixture-' || :'fixture_key' || '-review-retry-' || l.lesson_id, now() - interval '85 minutes', now() - interval '84 minutes', now() - interval '83 minutes'
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks' AND l.idx IN (3, 7, 12);

-- Curriculum review events (legacy without checks, and completed with code checks)
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'curriculum_review', 0, 'result', 'A4', 'Legacy fixture review without saved checks.', '{}'::jsonb, now() - interval '115 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'curriculum_review', 1, 'result', 'A4', 'Fixture A4 review completed.',
       '{"checks":[{"criterion":"outcome_coverage","result":"ok","basis":"Each outcome has a lesson.","refs":["fixture-outcome-1"],"verified_by":"reasoning"}],"code_checks":[{"id":"curriculum.lesson_rules","passed":2,"total":2}]}'::jsonb,
       now() - interval '108 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Step 6 events: exactly 62 events
-- (27 attempt 0 progress + 27 attempt 0 result + 3 attempt 1 progress + 3 attempt 1 result + 2 cycle summaries = 62)
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 0, 'progress', 'A5',
       'Gửi yêu cầu soạn ' || l.lesson_title,
       jsonb_build_object('lesson_id', l.lesson_id),
       now() - interval '100 minutes' + (l.idx * interval '10 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 0, 'result', 'A5',
       'Đã soạn xong bản nháp ' || l.lesson_title,
       jsonb_build_object('lesson_id', l.lesson_id),
       now() - interval '98 minutes' + (l.idx * interval '10 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 1, 'progress', 'A5',
       'Gửi yêu cầu soạn lại ' || l.lesson_title,
       jsonb_build_object('lesson_id', l.lesson_id),
       now() - interval '95 minutes' + (l.idx * interval '15 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks' AND l.idx IN (3, 7, 12);

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 1, 'result', 'A5',
       'Đã cập nhật bản soạn lại ' || l.lesson_title,
       jsonb_build_object('lesson_id', l.lesson_id),
       now() - interval '93 minutes' + (l.idx * interval '15 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks' AND l.idx IN (3, 7, 12);

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 1, 'progress', 'A5',
       'Bắt đầu vòng soạn lại cho 3 bài học cần hiệu chỉnh.',
       '{}'::jsonb,
       now() - interval '96 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 1, 'result', 'A5',
       'Đã hoàn thành soạn thảo toàn bộ 27 bài học.',
       '{}'::jsonb,
       now() - interval '92 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Step 7 events: exactly 64 events
-- (27 attempt 0 progress + 27 attempt 0 result + 3 attempt 1 progress + 3 attempt 1 result + 4 cycle events = 64)
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 0, 'progress', 'A6',
       'Gửi yêu cầu kiểm tra ' || l.lesson_title,
       jsonb_build_object('lesson_id', l.lesson_id),
       now() - interval '90 minutes' + (l.idx * interval '10 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 0, 'result', 'A6',
       CASE WHEN l.idx IN (3, 7, 12) THEN
         'Duyệt bài học ' || l.lesson_title || ' cần sửa lại: 1 lỗi blocking.'
       ELSE
         'Duyệt đạt bài học ' || l.lesson_title || '.'
       END,
       CASE WHEN l.idx IN (3, 7, 12) THEN
         jsonb_build_object(
           'lesson_id', l.lesson_id,
           'verdict', 'needs_fix',
           'blocking', 1,
           'minor', 0,
           'blocking_categories', jsonb_build_array('wrong_facts_or_definitions'),
           'checks', jsonb_build_array(
             jsonb_build_object('criterion', 'outcome_coverage', 'result', 'ok', 'basis', 'Đầy đủ mục tiêu', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'factual_accuracy_by_sources', 'result', 'issue', 'basis', 'Sai lệch định nghĩa', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             jsonb_build_object('criterion', 'supported_platform_formats', 'result', 'ok', 'basis', 'Đúng định dạng', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'no_submissions', 'result', 'ok', 'basis', 'Không nộp bài', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'tool_versions', 'result', 'ok', 'basis', 'Phiên bản chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Đúng trình tự', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             jsonb_build_object('criterion', 'outcome_and_level_fit', 'result', 'ok', 'basis', 'Phù hợp trình độ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
           ),
           'code_checks', jsonb_build_array(
             'Quy tắc publish của app cho lesson (validateLesson): tiêu đề, cấu hình theo format.',
             'source_ids nằm trong source_ids của lesson ở curriculum; resource do A5 viết thuộc nguồn research đã đọc;'
           )
         )
       ELSE
         jsonb_build_object(
           'lesson_id', l.lesson_id,
           'verdict', 'pass',
           'blocking', 0,
           'minor', 0,
           'blocking_categories', '[]'::jsonb,
           'checks', jsonb_build_array(
             jsonb_build_object('criterion', 'outcome_coverage', 'result', 'ok', 'basis', 'Đầy đủ mục tiêu', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'factual_accuracy_by_sources', 'result', 'ok', 'basis', 'Nội dung chuẩn xác', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             jsonb_build_object('criterion', 'supported_platform_formats', 'result', 'ok', 'basis', 'Đúng định dạng', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'no_submissions', 'result', 'ok', 'basis', 'Không nộp bài', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'tool_versions', 'result', 'ok', 'basis', 'Phiên bản chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
             jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Khớp lộ trình', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
             CASE WHEN l.idx = 1 THEN
               jsonb_build_object('criterion', 'quiz_answers', 'result', 'unverified', 'basis', 'Chưa kiểm chứng bằng công cụ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
             ELSE
               jsonb_build_object('criterion', 'outcome_and_level_fit', 'result', 'ok', 'basis', 'Phù hợp trình độ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
             END
           ),
           'code_checks', jsonb_build_array(
             'Quy tắc publish của app cho lesson (validateLesson): tiêu đề, cấu hình theo format.',
             'source_ids nằm trong source_ids của lesson ở curriculum; resource do A5 viết thuộc nguồn research đã đọc;'
           )
         )
       END,
       now() - interval '88 minutes' + (l.idx * interval '10 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 1, 'progress', 'A6',
       'Gửi yêu cầu rà soát bản sửa ' || l.lesson_title,
       jsonb_build_object('lesson_id', l.lesson_id),
       now() - interval '85 minutes' + (l.idx * interval '15 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks' AND l.idx IN (3, 7, 12);

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 1, 'result', 'A6',
       'Duyệt đạt bản sửa ' || l.lesson_title,
       jsonb_build_object(
         'lesson_id', l.lesson_id,
         'verdict', 'pass',
         'blocking', 0,
         'minor', 0,
         'blocking_categories', '[]'::jsonb,
         'checks', jsonb_build_array(
           jsonb_build_object('criterion', 'outcome_coverage', 'result', 'ok', 'basis', 'Đầy đủ mục tiêu', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'factual_accuracy_by_sources', 'result', 'ok', 'basis', 'Đã sửa chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
           jsonb_build_object('criterion', 'supported_platform_formats', 'result', 'ok', 'basis', 'Đúng định dạng', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'no_submissions', 'result', 'ok', 'basis', 'Không nộp bài', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'tool_versions', 'result', 'ok', 'basis', 'Phiên bản chuẩn', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'tool'),
           jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Đã hiệu chỉnh đạt yêu cầu.', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'source'),
           jsonb_build_object('criterion', 'outcome_and_level_fit', 'result', 'ok', 'basis', 'Phù hợp trình độ', 'refs', jsonb_build_array(l.lesson_id), 'verified_by', 'reasoning')
         ),
         'code_checks', jsonb_build_array(
           'Quy tắc publish của app cho lesson (validateLesson): tiêu đề, cấu hình theo format.',
           'source_ids nằm trong source_ids của lesson ở curriculum; resource do A5 viết thuộc nguồn research đã đọc;'
         )
       ),
       now() - interval '83 minutes' + (l.idx * interval '15 seconds')
FROM studio_ui_fixture_runs r
CROSS JOIN studio_ui_fixture_lessons l
WHERE r.case_key = 'review_checks' AND l.idx IN (3, 7, 12);

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 0, 'progress', 'A6',
       'Bắt đầu kiểm tra và rà soát chất lượng 27 bài học.',
       jsonb_build_object('completed_lessons', 0, 'lessons_total', 27),
       now() - interval '91 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 0, 'progress', 'A6',
       'Phát hiện 3 bài học cần tinh chỉnh nội dung.',
       jsonb_build_object('revisions_needed', 3),
       now() - interval '87 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 1, 'progress', 'A6',
       'Bắt đầu vòng sửa review cho 3 bài học.',
       jsonb_build_object('round', 1),
       now() - interval '86 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 1, 'result', 'A6',
       'Đã hoàn thành kiểm tra và sửa: 27/27 bài học đạt tiêu chuẩn.',
       jsonb_build_object('completed_lessons', 27, 'lessons_total', 27),
       now() - interval '82 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Step 8: Structure check with all 6 required rule categories and realistic counts
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, message, payload, created_at)
SELECT r.run_id, 'structure_check', 0, 'result', 'Đạt kiểm tra cấu trúc toàn khóa học.',
       jsonb_build_object('checks', jsonb_build_array(
         jsonb_build_object('id', 'structure.curriculum_match', 'passed', 27, 'total', 27),
         jsonb_build_object('id', 'structure.review_refs', 'passed', 4, 'total', 4),
         jsonb_build_object('id', 'structure.prerequisite_refs', 'passed', 8, 'total', 8),
         jsonb_build_object('id', 'structure.accepted_lessons', 'passed', 27, 'total', 27),
         jsonb_build_object('id', 'structure.lesson_rules', 'passed', 27, 'total', 27),
         jsonb_build_object('id', 'structure.links', 'passed', 41, 'total', 41,
           'warning_refs', jsonb_build_array('https://example.com/api-docs', 'https://example.com/reference'))
       )),
       now() - interval '70 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Step 9: Journey test with all 6 required rule categories and realistic counts
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, message, payload, created_at)
SELECT r.run_id, 'journey_test', 0, 'result', 'Đạt kiểm tra hành trình học tập.',
       jsonb_build_object('checks', jsonb_build_array(
         jsonb_build_object('id', 'journey.outcome_order', 'passed', 5, 'total', 5),
         jsonb_build_object('id', 'journey.lesson_order', 'passed', 12, 'total', 12),
         jsonb_build_object('id', 'journey.accepted_lessons', 'passed', 27, 'total', 27),
         jsonb_build_object('id', 'journey.quiz_thresholds', 'passed', 3, 'total', 3),
         jsonb_build_object('id', 'journey.code_exercises', 'passed', 4, 'total', 4),
         jsonb_build_object('id', 'journey.practice_no_submission', 'passed', 3, 'total', 3)
       )),
       now() - interval '65 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'review_checks';

-- Paused run progress event
INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, message, payload, created_at)
SELECT r.run_id, 'brief', 0, 'progress', 'Tạm dừng lượt chạy; có hiệu lực từ lần tick kế tiếp.',
       jsonb_build_object('paused_at', now() - interval '5 minutes'), now() - interval '5 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'paused_run';

-- ============================================================================
-- Case: malformed_draft for testing Error Boundary on corrupted generation output
-- ============================================================================
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'brief', NULL, NULL, 0, 'A2', 'text', 'ai',
       'openai', 'fixture-brief', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       '{"topic":"Chủ đề kiểm thử","audience":"Người mới","level":"beginner","goals":[],"scope":[],"out_of_scope":[],"prerequisites":[],"tools":[],"duration_hint":"","assumptions":[],"open_questions":[]}'::jsonb,
       'completed', 'fixture-' || :'fixture_key' || '-malformed-brief', now() - interval '9 minutes', now() - interval '8 minutes 30 seconds', now() - interval '8 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'malformed_draft';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'curriculum', NULL, NULL, 0, 'A3', 'text', 'ai',
       'openai', 'fixture-curriculum', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       '{"outcomes":[],"modules":[{"id":"m1","title":"Module 1","description":"","lessons":[{"id":"malformed-lesson","title":"Bài học lỗi","format":"quiz"}]}]}'::jsonb,
       'completed', 'fixture-' || :'fixture_key' || '-malformed-curriculum', now() - interval '7 minutes', now() - interval '6 minutes 30 seconds', now() - interval '6 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'malformed_draft';

-- Corrupted generation: quiz with null questions will trigger runtime error caught by StepErrorBoundary
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lessons', 'malformed-lesson', NULL, 0, 'A5', 'text', 'ai',
       'anthropic', 'fixture-lesson', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       jsonb_build_object(
         'title', 'Bài học cố ý thiếu trường',
         'short_description', 'Mô tả bài học dùng để kiểm tra error boundary cục bộ.',
         'duration_seconds', 180,
         'resources', '[]'::jsonb,
         'source_ids', '[]'::jsonb,
         'summary', 'Bản nháp sinh lỗi render',
         'article', NULL,
         'code', NULL,
         'quiz', jsonb_build_object('questions', NULL),
         'practice', NULL,
         'video', NULL
       ),
       'completed', 'fixture-' || :'fixture_key' || '-malformed-lesson', now() - interval '5 minutes', now() - interval '4 minutes 30 seconds', now() - interval '4 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'malformed_draft';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lessons', 0, 'result', 'A5', 'Đã tạo bản nháp bài học cố ý thiếu trường.',
       jsonb_build_object('lesson_id', 'malformed-lesson'), now() - interval '4 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'malformed_draft';


-- ============================================================================
-- Case: needs_fix_lesson for testing warning line and summary when a lesson review is not passing
-- ============================================================================
INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'curriculum', NULL, NULL, 0, 'A3', 'text', 'ai',
       'openai', 'fixture-curriculum', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       '{"outcomes":[],"modules":[{"id":"m1","title":"Module 1","description":"","lessons":[{"id":"failing-lesson","title":"Bài học cần sửa","format":"article"}]}]}'::jsonb,
       'completed', 'fixture-' || :'fixture_key' || '-needs-fix-curriculum', now() - interval '15 minutes', now() - interval '14 minutes', now() - interval '13 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'needs_fix_lesson';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lessons', 'failing-lesson', NULL, 0, 'A5', 'text', 'ai',
       'anthropic', 'fixture-lesson', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       jsonb_build_object(
         'title', 'Bài học cần sửa',
         'short_description', 'Mô tả bài học có lỗi cần sửa.',
         'duration_seconds', 300,
         'resources', '[]'::jsonb,
         'source_ids', jsonb_build_array('s1'),
         'summary', 'Bài học đang trong quá trình sửa',
         'article', jsonb_build_object('description_markdown', 'Nội dung bài viết', 'diagrams', '[]'::jsonb),
         'quiz', NULL,
         'code', NULL,
         'practice', NULL,
         'video', NULL
       ),
       'completed', 'fixture-' || :'fixture_key' || '-needs-fix-lesson', now() - interval '10 minutes', now() - interval '9 minutes', now() - interval '8 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'needs_fix_lesson';

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, catalog_job_id, attempt, agent_role, kind, origin,
  provider, requested_model_id, model_id, prompt_version, params, input, output,
  status, provider_request_id, created_at, submitted_at, completed_at
)
SELECT r.run_id, 'lesson_review', 'failing-lesson', NULL, 0, 'A6', 'review', 'ai',
       'anthropic', 'fixture-review', 'fixture-result', 'fixture-v1', '{}'::jsonb, '{}'::jsonb,
       jsonb_build_object(
         'verdict', 'needs_fix',
         'summary', 'Phát hiện thiếu kiến thức tiên quyết.',
         'issues', jsonb_build_array(
           jsonb_build_object(
             'location', 'lesson.description_markdown',
             'problem', 'Chưa nêu kiến thức tiên quyết cần học trước',
             'fix', 'Bổ sung danh sách prerequisite',
             'criterion', 'prerequisites',
             'category', 'outcome_mismatch',
             'severity', 'blocking',
             'verified_by', 'source'
           )
         ),
         'checks', jsonb_build_array(
           jsonb_build_object('criterion', 'prerequisites', 'result', 'issue', 'basis', 'Thiếu prerequisite', 'refs', jsonb_build_array('failing-lesson'), 'verified_by', 'source'),
           jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Đúng vị trí', 'refs', jsonb_build_array('failing-lesson'), 'verified_by', 'source')
         )
       ),
       'completed', 'fixture-' || :'fixture_key' || '-needs-fix-review', now() - interval '5 minutes', now() - interval '4 minutes', now() - interval '3 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'needs_fix_lesson';

INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload, created_at)
SELECT r.run_id, 'lesson_review', 0, 'result', 'A6',
       'Duyệt bài học Bài học cần sửa: 1 lỗi blocking.',
       jsonb_build_object(
         'lesson_id', 'failing-lesson',
         'verdict', 'needs_fix',
         'blocking', 1,
         'minor', 0,
         'blocking_categories', jsonb_build_array('outcome_mismatch'),
         'checks', jsonb_build_array(
           jsonb_build_object('criterion', 'prerequisites', 'result', 'issue', 'basis', 'Thiếu prerequisite', 'refs', jsonb_build_array('failing-lesson'), 'verified_by', 'source'),
           jsonb_build_object('criterion', 'lesson_sequence', 'result', 'ok', 'basis', 'Đúng vị trí', 'refs', jsonb_build_array('failing-lesson'), 'verified_by', 'source')
         ),
         'code_checks', jsonb_build_array('Quy tắc publish của app cho lesson (validateLesson): tiêu đề, cấu hình theo format.')
       ),
       now() - interval '3 minutes'
FROM studio_ui_fixture_runs r WHERE r.case_key = 'needs_fix_lesson';

SELECT case_key, course_id, run_id FROM studio_ui_fixture_runs ORDER BY case_key;
COMMIT;
