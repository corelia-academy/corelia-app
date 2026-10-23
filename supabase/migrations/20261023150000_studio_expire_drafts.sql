-- Studio drafts (a course with status 'idea' and no path) expire: the tick deletes the ones whose last
-- edit is older than p_ttl. updated_at is the last edit (trg_studio_courses_touch_updated_at), so
-- every edit extends the draft. A course that already has a run or a research job is never touched.
-- The TTL is passed by the caller (DRAFT_TTL_DAYS in corelia-api/studio/drafts.ts; Studio shows the
-- remaining days from the same value in src/lib/catalog.ts).

CREATE FUNCTION private.studio_purge_expired_drafts(p_ttl interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_ttl IS NULL OR p_ttl <= interval '0' THEN
    RAISE EXCEPTION 'invalid_ttl' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.studio_courses c
  WHERE c.status = 'idea'
    AND c.updated_at < now() - p_ttl
    AND NOT EXISTS (SELECT 1 FROM public.studio_course_paths cp WHERE cp.course_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.studio_runs r WHERE r.course_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.studio_catalog_jobs j WHERE j.course_id = c.id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE FUNCTION public.studio_purge_expired_drafts(p_ttl interval)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_purge_expired_drafts(p_ttl);
$$;

REVOKE ALL ON FUNCTION
  private.studio_purge_expired_drafts(interval),
  public.studio_purge_expired_drafts(interval)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  private.studio_purge_expired_drafts(interval),
  public.studio_purge_expired_drafts(interval)
TO service_role;
