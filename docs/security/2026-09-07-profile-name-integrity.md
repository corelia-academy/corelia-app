# Profile text integrity remediation — 2026-09-07

Read-only production inspection found U+FFF6 in 74 of 174 profile names,
including 69 names of exactly 2,031 characters and one of 221,465 characters.
72 affected names contained no visible text after removal. The same character
also occurred in one username, one biography, and one certificate holder name.
Current Auth name metadata did not contain U+FFF6. This establishes stored data
corruption, not the identity or access method of its author. Row `updated_at`
is not a field-level history. Existing privilege audit records include 25 blocked
role/tier changes in June; they do not establish the source of the name edits.

## Remediation

- Preserve original names and affected fields in RLS-enabled private recovery
  tables, with client access revoked. No raw profile payloads are committed.
- Prefer the cleaned visible name, then a valid Auth metadata name; otherwise
  use null. Preserve certificate name evidence before repairing its copy.
- Normalize signup metadata without blocking account creation. Enforce a
  160-code-point name limit and canonical, nonblank names in both profile tables.
  Keep accents, non-Latin scripts, and legitimate ZWJ/ZWNJ script joiners.
- Reject hidden control/filler payloads in all profile fields, with a 16,384
  character field ceiling and 160-character username ceiling.
- Validate self-service and admin client name writes; show the form name limit.
- Audit subsequent name changes with actor ID and before/after names.
- Cover both INSERT and UPDATE in the role/tier guard. A missing JWT subject
  alone no longer establishes a trusted caller. Profile IDs are immutable.
- Reconcile profile policies across historical local/live policy names; enforce
  self/staff ownership with USING and WITH CHECK. Remove unnecessary anonymous,
  destructive, and public-mirror write grants.

## Validation and rollout

`src/lib/profileName.test.ts` covers the observed payload, Unicode names,
normalization, limits, and metadata types. The database integration gate runs
`scripts/db/tests/profile-name-integrity.integration.sql` for signup, invalid
names/biographies/usernames, cross-user denial, INSERT/UPDATE escalation denial,
public mirroring, and auditing. Fixtures roll back.

Apply the forward migration through the staging workflow, verify live
constraints and UI behavior, then follow the main/production release workflow.
After production, check zero U+FFF6 occurrences in affected fields, recovery
source counts, public mirror parity, and Supabase security advisors. Recovery
records remain private for incident review; do not expose them through an RPC.

This change closes the identified profile integrity paths. It does not prove
that historical account compromise is fully contained or replace a review of
account access, external credentials, and retained incident logs.
