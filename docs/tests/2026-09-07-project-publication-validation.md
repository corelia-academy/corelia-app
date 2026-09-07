# Project publication requirements and Markdown editor

Public and unlisted saves require a summary and detailed description containing text (whitespace, invisible characters and punctuation alone do not count). Hackathon saves also require progress and at least one demo/repository/slide/video resource. Private standalone drafts may remain incomplete. Existing project source and omitted story fields are resolved server-side; explicit clearing is validated. Requirements apply to both creation and edits through the authenticated save API. This change does not retroactively delete or rewrite previously published records.

The project editor now offers Write/Preview tabs and heading, bold, italic, list, link and code formatting for description/progress. Preview reuses the sanitized Markdown renderer from project detail. Counters explicitly show maximum characters: title/slug 160, summary 1000, description 20000, progress 10000 and each URL 2048. Backend validation enforces the same limits.

Validation before staging:
- Full suite: 64 files / 376 tests passed before adding the final whitespace-source regression case; final handler suite rerun separately.
- Lint, staging build/typecheck, database governance checks passed.
- Regression cases cover missing/whitespace/punctuation content, unlisted/private visibility, hackathon requirements, source spoofing, legacy omitted fields, explicit clearing, URL/slug limit boundaries, Markdown formatting/preview persistence and toolbar length limits.

No schema migration is needed; existing direct authenticated project writes are revoked and project saves use the authenticated Edge API.
