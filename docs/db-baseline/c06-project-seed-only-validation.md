# C-06 staging and production validation

## Pre-deploy read-only checks

Run against the exact target database before applying the migration:

```sql
WITH project_link_duplicates AS (
  SELECT source_type, source_submission_id, count(*) AS project_count
  FROM public.projects
  WHERE source_type IN ('contest', 'course') AND source_submission_id IS NOT NULL
  GROUP BY source_type, source_submission_id
  HAVING count(*) > 1
)
SELECT count(*) AS duplicate_source_links
FROM project_link_duplicates;
```

Expected: `0`. The existing unique key is `(owner_id, source_type, source_submission_id)`; do not add a broader polymorphic foreign key or uniqueness rule in C-06.

## Staging validation after migration apply

1. Confirm `20260823120000_seed_projects_without_overwrite` appears in the target migration ledger.
2. Read `pg_get_functiondef` for both `private.sync_project_from_*_submission` functions; each must use `ON CONFLICT ... DO NOTHING` and contain no `DO UPDATE SET`.
3. Create one eligible Hackathon submission and confirm one seeded project with matching `owner_id`, `source_type = 'contest'`, `source_id`, and `source_submission_id`.
4. Edit the seeded project's title/summary/URLs as its owner, then update the source submission. Confirm project values are unchanged.
5. Update the same submission again. Confirm its project count remains one.
6. Repeat steps 3–5 for one final-assignment submission; its project must remain `source_type = 'course'` and `visibility = 'unlisted'`.
7. Update a submission whose linked project was deliberately removed only in disposable test data. Confirm one new seed is created; this is why the triggers remain `AFTER INSERT OR UPDATE`.
8. Confirm owner RLS still permits the existing project update path and no unrelated project changes occur.
9. Re-run baseline/catalog comparison and inspect logs for trigger errors.

## Production rollout

1. Require CI: `pnpm db:verify`, guardrail tests, `pnpm test`, lint, production build and isolated clean migration recreate.
2. Re-run the pre-deploy duplicate query against `corelia-app` Main, read-only.
3. Obtain explicit Main approval.
4. Apply only the new migration through the protected production workflow.
5. Verify ledger/function definitions and run one controlled post-deploy validation using non-production test data only when an approved test account exists.
6. If a regression is found, stop rollout and use a forward migration only. Do not restore `DO UPDATE` as a shortcut, because that would overwrite portfolio edits.
