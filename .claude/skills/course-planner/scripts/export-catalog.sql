-- .claude/skills/course-planner/scripts/export-catalog.sql
-- File SQL chỉ đọc (Read-only) để người dùng tự chạy trên Supabase SQL Editor
-- và xuất dữ liệu catalog ra JSON, sau đó lưu vào .course-plan/catalog-export.json.
--
-- Đã đối chiếu với schema thực tế:
--   - public.courses (id, slug, published, archived_at, data)
--   - public.course_sections (course_id, id, sort_order, data)
--   - public.course_lessons (course_id, id, section_id, sort_order, published, archived_at, data)

SELECT jsonb_pretty(jsonb_agg(course_data ORDER BY course_data->>'title')) AS catalog_export
FROM (
  SELECT jsonb_build_object(
    'slug', c.slug,
    'title', COALESCE(c.data->>'title', c.slug),
    'level', COALESCE(c.data->>'level', 'all'),
    'state', 'in_catalog',
    'source', 'db_export',
    'is_updating', COALESCE((c.data->>'is_updating')::boolean, false),
    'goals', COALESCE(c.data->'learning_outcomes', '[]'::jsonb),
    'outcomes', COALESCE(c.data->'learning_outcomes', '[]'::jsonb),
    'lesson_counts', jsonb_build_object(
      'total', COALESCE(
        (
          SELECT COUNT(*)::int
          FROM public.course_lessons l
          WHERE l.course_id = c.id
            AND l.archived_at IS NULL
        ),
        0
      ),
      'published', COALESCE(
        (
          SELECT COUNT(*)::int
          FROM public.course_lessons l
          WHERE l.course_id = c.id
            AND l.published = true
            AND l.archived_at IS NULL
        ),
        0
      )
    ),
    'published_lessons', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'section_title', COALESCE(s.data->>'title', s.id),
            'title', COALESCE(l.data->>'title', l.id),
            'section_order', s.sort_order,
            'lesson_order', l.sort_order
          ) ORDER BY s.sort_order, l.sort_order
        )
        FROM public.course_sections s
        JOIN public.course_lessons l ON l.section_id = s.id AND l.course_id = c.id
        WHERE s.course_id = c.id
          AND l.published = true
          AND l.archived_at IS NULL
      ),
      '[]'::jsonb
    ),
    'modules', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', COALESCE(s.data->>'title', s.id),
            'lessons', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', l.id,
                    'title', COALESCE(l.data->>'title', l.id),
                    'published', l.published
                  ) ORDER BY l.sort_order
                )
                FROM public.course_lessons l
                WHERE l.course_id = c.id
                  AND l.section_id = s.id
                  AND l.archived_at IS NULL
              ),
              '[]'::jsonb
            )
          ) ORDER BY s.sort_order
        )
        FROM public.course_sections s
        WHERE s.course_id = c.id
      ),
      '[]'::jsonb
    )
  ) AS course_data
  FROM public.courses c
  WHERE c.archived_at IS NULL
) sub;
