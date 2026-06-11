# Supabase Security Check

This audit pass hardens the highest-risk write surfaces that were still relying
too heavily on client-side rules.

## Covered in this pass

- Shared DB authorization helpers for course and hackathon checks
- Course-domain RLS normalization
- Credential (OCB + OCA) write enforcement at DB level
- Inventory snapshot for current write surfaces
- Storage policy tightening for:
  - course thumbnails
  - course assets
  - certificate templates
  - course credential images (OCB badge art / OCA cert art)
  - hackathon badge images
  - activity milestone badge images
- final assignment uploads
  - instructor partner documents

## Inventory snapshot

### Course domain

- Tables:
  - `courses`
  - `course_sections`
  - `course_lessons`
  - `course_locales`
  - `course_section_locales`
  - `course_lesson_locales`
  - `course_discounts`
  - `enrollments`
  - `lesson_progress`
  - `final_assignment_submissions`
- Client write libs:
  - `src/lib/courses.ts`
  - `src/lib/discounts.ts`
  - `src/lib/finalAssignment.ts`

### Credentials (OCB + OCA)

- Tables:
  - `credential_templates`
  - `credential_issuances`
  - `user_notifications` (in-app bell for mint events)
- Client write lib:
  - `src/lib/credentialTemplates.ts`

### Hackathons

- Tables:
  - `hackathons`
  - `hackathon_locales`
  - `hackathon_registrations`
  - `hackathon_access_invites`
  - `hackathon_submissions`
  - `hackathon_scores`
- Client write lib:
  - `src/lib/hackathons.ts`

### Projects / collaboration

- Tables:
  - `projects`
  - `project_locales`
  - `project_collaborators`
  - `project_collaboration_invites`
  - `project_comments`
  - `project_hearts`
- Client/RPC entrypoints:
  - `src/lib/projects.ts`
  - `src/lib/projectCollaboration.ts`
  - `src/lib/projectSocial.ts`

### Profiles / admin / config

- Tables:
  - `profiles`
  - `dashboard_configs`
  - `user_notifications`
- Client write libs:
  - `src/lib/profile.ts`
  - `src/lib/dashboardConfig.ts`

### Storage paths

- Course:
  - `course-thumbnails`
  - `course-sponsor-logos`
  - `course-partners`
  - `course-partner-brand`
  - `course-partner-docs`
  - `certificate-templates`
  - `course-credential-badges`
- Hackathon:
  - `contest-banners`
  - `contest-thumbnails`
  - `contest-org-partner-logos`
  - `hackathon-credential-badges`
- Other:
  - `activity-milestone-badges`
  - `final-assignment-submissions`
  - `instructor-partner-docs`
  - `avatars`

## Main findings

- `credential_templates` already had a course-specific credential hardening migration,
  but the broader course domain still mixed owner/staff and co-instructor access
  too loosely. Templates now support both OCB (`collection_symbol = 'ocbadge'`) and
  OCA (`collection_symbol IS NULL`) credential types with the same write restrictions.
- Several course child tables allowed writes based on "has any
  co_instructor_permissions entry" instead of feature-specific permission keys.
- Storage write coverage was uneven:
  - some paths only had `INSERT` checks but weak or missing `UPDATE/DELETE`
  - some sensitive document paths were readable too broadly
  - newer asset paths such as `course-credential-badges` were not expressed in
    the original storage policy set

## New helper functions

- `private.is_corelia_instructor(uuid)`
- `private.can_manage_course(text, uuid)`
- `private.can_manage_course_feature(text, uuid, text)`
- `private.can_manage_corelia_course_ocb(text, uuid)`
- `private.can_manage_hackathon(text, uuid)`

These helpers are used by RLS and storage policies so the same business rule is
enforced consistently across UI, DB writes, and asset uploads.

## Policy changes in this pass

### Course domain

- Root `courses` updates are restricted to owner or admin/support.
- `course_sections`, `course_lessons`, and locale tables now require
  `content` capability for writes.
- `course_discounts` now require `pricing` capability.
- `final_assignment_submissions` reviewer access now requires `submissions`
  capability.

### Credentials (OCB + OCA)

- Credential write access remains strict at `credential_templates`:
  Corelia-owned course only, plus Corelia instructor or admin/support only.
  Applies equally to OCB templates (`collection_symbol = 'ocbadge'`) and
  OCA templates (`collection_symbol IS NULL`).

### Storage

- Public/decorative assets remain readable where intended.
- Sensitive assets now require explicit role/feature checks:
  - certificate templates
  - course partner docs
  - instructor partner docs
  - final assignment files
- Credential image writes (both OCB badge art and OCA cert art) follow the
  same Corelia-only rule as the DB template write.

## Function and RPC review

- Already reviewed in existing migrations:
  - `batch_update_lesson_orders` switched away from `SECURITY DEFINER`
  - project collaboration RPCs were moved to `SECURITY INVOKER` and execute
    grants tightened
  - certificate readiness service-only path was explicitly revoked from clients
- Current pass does not change RPC bodies, but the new helper functions are
  designed so later migrations can reuse the same course/hackathon checks
  instead of re-embedding raw JSON permission logic in each policy.

## Remaining follow-up items

- Review `enrollments` / `lesson_progress` against payment-access semantics if
  the product wants stricter learner-side DB enforcement than the current UI
  flow.
- Review hackathon storage paths beyond the ones covered here if new asset
  categories are added.
- Add automated policy matrix tests in a local Supabase test harness so role
  regressions are caught before deploy.
