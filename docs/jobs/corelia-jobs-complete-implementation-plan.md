# Corelia Jobs — Complete Implementation Plan
## Curated Technology/Web3 Company Jobs + AI Cleaning + Market Intelligence

**Version:** September 2026
**Primary stack assumption:** React/TypeScript + Supabase/PostgreSQL
**Core operating principle:** Curated sources, deterministic filtering first, AI for new/changed jobs or a new classifier version, daily market analytics.

**Operator docs:** [Setup và vận hành](./README.md) · [Test checklist](./TEST_CHECKLIST.md)

---

# Implementation Baseline (Repository-Aligned MVP)

This document remains the complete product direction. The September 2026
implementation deliberately ships a safe, operable first slice that fits the
current Corelia architecture instead of introducing a separate service.

## Implemented in this repository

- Public routes: `/jobs`, `/jobs/:slug`, and `/jobs/market`.
- Authenticated user routes: `/jobs/saved`, `/jobs/applied`, and `/jobs/hidden`.
  Hidden jobs can be reviewed and restored; this private route is intentionally
  excluded from the public sitemap.
- Admin routes: `/admin/jobs`, `/admin/jobs/review`, `/admin/jobs/sources`,
  `/admin/jobs/companies`, `/admin/jobs/crawlers`, and `/admin/jobs/analytics`.
- Supabase schema, explicit grants, RLS, public/private data separation,
  lifecycle events, coverage snapshots, and daily market aggregates.
- User-facing catalog, detail, and saved/applied/hidden queries explicitly
  enforce the public visibility gates even when the viewer is staff/admin.
- Direct ATS adapters for Greenhouse, Lever (global and EU), Ashby, and
  SmartRecruiters.
- Raw payload staging, source-identity deduplication, canonical URL linking,
  content hashing, unchanged-job short circuit, automatic expiry after a
  successful complete feed, and manual overrides that survive later crawls.
- Deterministic hard filtering plus optional OpenAI Responses API structured
  classification. AI is not invoked for unchanged input under the same
  classifier version. If AI is not
  configured or unavailable, new jobs fail safe into admin review.
- Admin controls for company registration, source enable/disable, manual crawl,
  review/publish/reject, run history, and analytics refresh.
- Vietnamese and English interface copy.

## Naming adjustments from the original design

- `companies` is implemented as `job_companies` to avoid claiming ownership of
  a future platform-wide company entity.
- `skills` is implemented as `job_skills` because Corelia does not yet have a
  shared canonical skills registry. A later migration can merge it when another
  feature becomes a real cross-feature consumer.
- Browser reads use the existing Supabase client/data-helper/TanStack Query
  pattern. Privileged crawl, classification, and review operations stay behind
  the existing `corelia-api` Edge Function boundary.

## Deferred after the MVP

- Aggregator-specific adapters and licensed/partner feeds.
- HTML/browser crawling, RSS/custom API adapters, and per-source rate-limit
  queues.
- Market drill-down routes (`roles`, `skills`, `domains`, `remote`,
  `entry-level`, `salary`) and richer cohort/growth charts.
- User job recommendations, alerts, and automatic matching; these are not part
  of the current product contract.

## Runtime setup

1. Apply `20260903033132_jobs_mvp_foundation.sql`, the forward-only
   `20260903055155_jobs_advisor_remediation.sql`, and
   `20260903062207_normalize_job_ai_quality_score.sql` through the normal
   migration release flow.
2. Deploy both `corelia-api` and `cron-jobs`.
3. Set a strong `CORELIA_JOBS_CRON_SECRET` on both functions. Set
   `OPENAI_API_KEY` to enable automatic AI-gated publishing and optionally set
   `CORELIA_JOBS_CLASSIFIER_MODEL` (default: `gpt-5.4-mini`).
4. Register and verify employer ATS identifiers in `/admin/jobs/companies`.
5. Configure Supabase Cron to call `POST /functions/v1/cron-jobs` hourly with
   `x-corelia-jobs-cron-secret`. Each company still inherits a 24-hour source
   cadence, while the default `{ "max_targets": 1 }` batch distributes due
   companies across small Edge invocations. Increase it only after observing
   duration and AI rate limits.
6. Run a manual crawl, inspect `/admin/jobs/review`, then verify `/jobs` and
   `/jobs/market` before enabling the recurring schedule.

Operational rule: enabling a source is not enough to expose its jobs. Public
visibility requires a reviewed source policy, an active canonical job, and an
unexpired listing; raw payloads, classifier evidence, crawler runs, and coverage
data remain staff-only.

---

# 0. Executive Decisions

Corelia Jobs should be built as:

> **A curated job board for technology and Web3 companies, with explicit Tech / Non-tech classification and a built-in hiring market dashboard.**

It should NOT be designed as:

- a generic job aggregator,
- a crawler that tries to ingest everything,
- an AI-heavy job matching product,
- a system where user traffic causes LLM token cost.

The full product has two user-facing utilities:

```text
CORELIA JOBS
├── Find Jobs
└── Understand the Market
```

The backend has five layers:

```text
Curated Sources
      ↓
Scheduled / Manual Crawl
      ↓
Hard Filter + Dedup
      ↓
AI Cleaning / Classification
      ↓
Quality Gate
      ↓
Canonical Jobs
      ↓
Historical Market Data
      ↓
Search + Market Insights
```

## Final architecture decisions

1. **Default crawl cadence: every 24 hours.**
2. Allow **12-hour cadence only for high-priority/fresh feeds**.
3. Admin can always trigger:
   - one source,
   - one company,
   - one adapter,
   - all enabled sources.
4. **Never re-run AI on unchanged jobs under the same classifier version.**
5. AI runs only after:
   - source validation,
   - obvious out-of-scope filtering,
   - exact duplicate detection,
   - content hash comparison.
6. AI returns both:
   - cleaned job metadata,
   - analytics metadata.
7. Market trends are calculated by SQL/analytics logic, **not by the LLM**.
8. All trend metrics must account for changing crawler coverage.
9. Direct employer ATS feeds are preferred over aggregator HTML.
10. HTML/browser crawling is the last resort.

---

# 1. Product Positioning

Recommended positioning:

> **Jobs across Technology and Web3**

Alternative user-facing copy:

> Find technical and non-technical opportunities at software, AI, Web3, infrastructure, data, security and developer-focused companies.

Corelia should remain opinionated about the scope.

Include jobs such as:

- Software Engineer
- Frontend Engineer
- Backend Engineer
- Full Stack Engineer
- Mobile Engineer
- DevOps Engineer
- SRE
- Platform Engineer
- AI Engineer
- ML Engineer
- Data Engineer
- Data Scientist
- Security Engineer
- QA Engineer
- Blockchain Engineer
- Smart Contract Engineer
- Developer Advocate
- DevRel
- Technical Writer
- Solutions Engineer
- Solutions Architect
- Product Engineer
- Technical Product Manager
- Engineering Manager
- Forward Deployed Engineer
- Social Media Manager
- Content Marketing Manager
- Product Marketing Manager
- Community Manager
- Product Designer
- Product Manager
- Business Development / Partnerships
- Sales / Customer Success
- Operations / Finance / People / Legal

Do not prioritize roles outside the tracked technology/Web3 company scope, such as:

- consumer retail and warehouse roles
- hospitality and clinical roles
- transport and local logistics roles
- generic offline sales unrelated to a tracked company

---

# 2. Product Surfaces

## 2.1 Job Board

Routes:

```text
/jobs
/jobs/:slug
/jobs/saved
/jobs/applied
/jobs/hidden
```

Core features:

- search
- role filter
- domain filter
- skills filter
- seniority filter
- remote/location filter
- employment type
- salary filter
- posted-date filter
- save
- mark applied
- hide
- review hidden jobs and restore them to the main list
- external apply

---

## 2.2 Market Intelligence

Routes:

```text
/jobs/market
/jobs/market/roles
/jobs/market/skills
/jobs/market/domains
/jobs/market/remote
/jobs/market/entry-level
/jobs/market/salary
```

Core user questions this section should answer:

- What roles are hiring most?
- Which roles are growing?
- Which skills are requested most?
- Which skills are growing fastest?
- What skills do Backend jobs require?
- What jobs commonly require Rust?
- Is AI hiring growing?
- Is Web3 hiring growing?
- How much of the market is remote?
- How many entry-level jobs exist?
- Which skills are most common in junior jobs?
- What salary ranges are visible for each role?

---

# 3. Core Taxonomy

Do not model the system as only:

```text
Web3
AI
```

Each job must be represented across independent dimensions:

```text
ROLE
JOB TYPE
DOMAIN
SKILLS
SENIORITY
LOCATION
WORK MODE
```

Example:

```text
Title:
Senior Backend Engineer

Role:
backend-engineering

Job Type:
tech

Domains:
web3
fintech

Required Skills:
rust
postgresql
solana

Preferred Skills:
kubernetes
aws

Seniority:
senior

Work Mode:
remote

Regions:
APAC
```

---

## 3.1 Job Type Taxonomy

Every canonical job has exactly one high-level type:

```text
tech
non_tech
```

`tech` means the role's core output is building, operating, securing, testing,
documenting, or directly supporting technical systems. `non_tech` covers
marketing, social/content, design, community, sales, recruiting, finance,
legal, and general operations—even when the employer or subject matter is
highly technical. Company boilerplate, collaboration with engineers, or words
such as “technical curiosity” are not sufficient evidence for `tech`.

Example: `Social & Technical Content Manager` maps to
`job_type = non_tech` and `primary_role = social-media`.

---

# 4. Role Taxonomy

## Software Engineering

```text
frontend-engineering
backend-engineering
fullstack-engineering
mobile-engineering
android-engineering
ios-engineering
desktop-engineering
embedded-engineering
blockchain-engineering
smart-contract-engineering
game-development
software-architecture
forward-deployed-engineering
general-software-engineering
```

## Infrastructure

```text
devops
devsecops
site-reliability-engineering
platform-engineering
cloud-engineering
network-engineering
database-engineering
infrastructure-engineering
```

## AI & Data

```text
ai-engineering
machine-learning-engineering
data-engineering
data-science
data-analysis
bi-analysis
mlops
ai-research
```

## Security

```text
cybersecurity
application-security
cloud-security
smart-contract-security
security-research
```

## Quality

```text
qa-engineering
test-automation
performance-testing
```

## Developer Ecosystem

```text
developer-relations
developer-advocacy
developer-experience
technical-writing
solutions-engineering
solutions-architecture
```

## Technical Product / Leadership

```text
product-engineering
technical-product-management
engineering-management
technical-program-management
```

## Product, Design, Marketing & Content

```text
product-management
program-management
product-design
ux-ui-design
social-media
content-marketing
product-marketing
growth-marketing
marketing
communications-pr
```

## Community, Business & Operations

```text
community-management
business-development
partnerships
sales
customer-success
customer-support
operations
finance-accounting
people-hr
recruiting
legal-compliance
```

This taxonomy should remain compatible with the broad role families seen on developer learning systems such as roadmap.sh, but Corelia owns its own canonical IDs.

---

# 5. Domain Taxonomy

Recommended domains:

```text
ai
web3
fintech
saas
cloud
developer-tools
cybersecurity
gaming
ecommerce
edtech
healthtech
data-infrastructure
enterprise-software
open-source
consumer
social
robotics
iot
general-software
```

A company can have multiple domains.

A job inherits company domains and may add job-specific domains.

Example:

```text
Company:
Supabase

Company domains:
developer-tools
cloud
data-infrastructure

Job:
AI Product Engineer

Final domains:
developer-tools
cloud
data-infrastructure
ai
```

---

# 6. Skill Registry

Corelia needs a canonical skill registry used across:

```text
Jobs
Roadmaps
Courses
Projects
Profiles
```

## Example categories

### Languages

```text
javascript
typescript
python
rust
go
java
c
cpp
csharp
php
ruby
kotlin
swift
dart
scala
elixir
solidity
move
```

### Frontend

```text
react
nextjs
vue
nuxt
angular
svelte
tailwind
vite
webpack
```

### Backend

```text
nodejs
nestjs
express
fastify
spring-boot
django
fastapi
flask
laravel
rails
dotnet
graphql
grpc
rest-api
microservices
```

### Database

```text
postgresql
mysql
mongodb
redis
elasticsearch
clickhouse
sqlite
dynamodb
cassandra
supabase
firebase
```

### Infrastructure

```text
docker
kubernetes
aws
gcp
azure
terraform
linux
cloudflare
nginx
github-actions
gitlab-ci
jenkins
prometheus
grafana
ansible
```

### AI

```text
machine-learning
deep-learning
llm
rag
ai-agents
pytorch
tensorflow
transformers
huggingface
langchain
llamaindex
computer-vision
nlp
```

### Web3

```text
ethereum
solana
sui
base
aptos
stellar
bitcoin
cosmos
avalanche
anchor
foundry
hardhat
ethers
viem
web3js
smart-contracts
defi
zero-knowledge
```

---

# 7. Skill Alias Registry

Never rely only on literal names.

Example:

```json
{
  "slug": "postgresql",
  "name": "PostgreSQL",
  "aliases": [
    "postgresql",
    "postgres",
    "postgre sql"
  ]
}
```

```json
{
  "slug": "nodejs",
  "name": "Node.js",
  "aliases": [
    "node.js",
    "nodejs",
    "node"
  ]
}
```

Important:

Use token-aware matching.

Do not detect `go` using naive substring search because:

```text
Google
ongoing
```

must not become:

```text
go
```

---

# 8. Source Strategy

The ingestion priority must be:

```text
Official employer ATS/API
       >
Official job API/feed
       >
Official RSS
       >
Curated job board API
       >
Server-rendered HTML
       >
Browser automation
```

The long-term backbone should be:

> **Company Registry + ATS Adapters**

not:

> dozens of independent scrapers.

---

# 9. Researched Source Matrix

## Tier S — Core ingestion backbone

### Greenhouse

**Use:** Official company jobs
**Method:** Job Board API
**Default cadence:** 24h
**High-priority cadence:** 12h
**Manual:** Yes

Greenhouse Job Board GET endpoints expose public job-board data without GET authentication and can return published jobs, descriptions, offices and departments.

Adapter:

```text
GreenhouseAdapter
```

Company config:

```text
board_token
```

Recommended list request:

```text
GET /v1/boards/{board_token}/jobs?content=true
```

Use official job URL as canonical source.

---

### Lever

**Use:** Official company jobs
**Method:** Postings API
**Default cadence:** 24h
**High-priority cadence:** 12h
**Manual:** Yes

Lever publishes jobs through its Postings REST API and supports JSON output.

Adapter:

```text
LeverAdapter
```

Config:

```text
site
region: global | eu
```

Use server-side requests, not browser CORS-dependent fetching.

---

### Ashby

**Use:** Official company jobs
**Method:** Public Job Postings API
**Default cadence:** 24h
**High-priority cadence:** 12h
**Manual:** Yes

Adapter:

```text
AshbyAdapter
```

Config:

```text
job_board_name
```

Use:

```text
includeCompensation=true
```

when available.

Ashby is especially valuable because returned job metadata can include:

- location
- secondary location
- department
- team
- employment type
- description
- compensation
- apply URL

---

### SmartRecruiters

**Use:** Official company jobs
**Method:** Posting API
**Default cadence:** 24h
**Manual:** Yes

Adapter:

```text
SmartRecruitersAdapter
```

Config:

```text
companyIdentifier
```

Public postings can be listed by company identifier. Before production, validate the current authentication requirement and account-specific access behavior for the selected companies.

---

## Tier A — Structured job feeds

> **Implementation status:** these source-level aggregators are part of the
> product direction, not the current MVP adapter set. The repository currently
> implements only the four company ATS adapters above. CryptoJobsList and
> web3.career remain unchecked in the Definition of Done until provider
> credentials, attribution policy, source-level pagination and ingestion are
> implemented end to end.

### CryptoJobsList

**Use:** Web3 expansion
**Method:** Official API
**Cadence:** 12–24h
**Manual:** Yes

Good for:

- blockchain
- Web3
- DeFi
- smart contracts
- community
- technical and non-technical Web3 jobs

The current API is explicitly marketed for:

- aggregators
- job boards
- research products
- hiring intelligence

Requirements:

- API key/application
- preserve canonical source URL
- follow attribution/use terms

---

### web3.career

**Use:** Web3 expansion
**Method:** Official API
**Cadence:** 12–24h
**Manual:** Yes

Current API supports filters such as:

```text
remote
limit
country
tag
show_description
```

The API terms require:

- link back through `apply_url`
- visible source attribution

Store these rules in the source policy table.

---

### Himalayas

**Use:** Remote software backfill
**Method:** Public JSON API
**Cadence:** 24h exactly
**Manual:** Yes, but do not encourage repeated runs

The public API:

- requires no authentication,
- supports cursor pagination,
- supports remote location, seniority and employment filters,
- is cached/refreshed roughly every 24 hours.

There is no benefit to polling more than daily.

Attribution/link-back is required.

---

### We Work Remotely

**Use:** Remote engineering coverage
**Method:** Official RSS
**Cadence:** 12–24h
**Manual:** Yes

Useful feeds:

- Programming
- Frontend
- Backend
- Full Stack
- DevOps/System Admin
- Product

Attribution back to We Work Remotely is requested.

Prefer RSS, not HTML scraping.

---

## Tier B — Optional / backfill

### Remotive

**Method:** Public API/RSS
**Cadence:** 24h
**Role:** Backfill only

Important:

- public API jobs are delayed,
- attribution is required,
- redistribution restrictions must be respected,
- do not gate Remotive listings behind signup.

Do not treat Remotive as a freshness source.

---

### Remote OK

Remote OK currently advertises:

- API feed
- JSON feed

Before production integration:

1. verify current feed format,
2. verify allowed redistribution,
3. verify attribution,
4. verify polling expectations.

Until the above is stored in `source_policies`, keep it disabled by default.

---

# 10. Discovery Sources — Not Core Crawlers

These sources are useful for discovering high-quality companies but should not become foundational HTML-scraping dependencies.

## Wellfound

Strength:

- very large startup inventory,
- strong AI/startup coverage,
- engineering roles,
- salary/equity visibility.

Use for:

```text
company discovery
market research
coverage gap analysis
```

Then look for the employer's:

```text
Greenhouse
Lever
Ashby
SmartRecruiters
official careers page
```

---

## Y Combinator Jobs

Strength:

- funded/vetted startup ecosystem,
- strong engineering,
- AI,
- developer tools,
- startup roles.

Use for:

```text
company discovery
company registry seeding
```

Then ingest through official ATS wherever possible.

---

## CryptocurrencyJobs.co / Remote3 / JobStash

Useful for:

- Web3 company discovery,
- taxonomy validation,
- source gap analysis.

If a structured, permitted feed is not available, prefer:

```text
discover company
→ locate official careers page
→ detect ATS
→ ingest official job
```

rather than depending on HTML scraping.

---

# 11. Vietnam Strategy

Vietnam coverage is important for Corelia.

## ITviec

Current product strengths include filters for:

- Internship
- Fresher
- Junior
- Senior
- Manager
- Remote
- Hybrid
- On-site
- technology skills
- role categories
- Vietnam cities

Use ITviec as:

- taxonomy benchmark,
- market discovery,
- local company discovery.

Do not make unsupported scraping a core dependency.

Preferred order:

```text
official feed / partnership
       >
company career page
       >
company ATS
```

---

## TopDev

Same strategy:

```text
partnership / supported feed
or
official company career sources
```

Do not build the MVP around local marketplace HTML scraping.

---

# 12. Company Registry

The system must know companies separately from jobs.

Recommended seed target:

```text
MVP:
100 curated companies

V1:
300 companies

Later:
500–1,000 high-quality companies
```

Company categories:

- AI
- Web3
- SaaS
- Developer Tools
- Cloud
- Data
- Fintech
- Security
- Open Source
- Vietnam Technology

---

# 13. ATS Detection

When admin adds a company career URL, detect patterns:

```text
boards.greenhouse.io
job-boards.greenhouse.io
jobs.lever.co
api.lever.co
jobs.ashbyhq.com
careers.smartrecruiters.com
```

Output:

```text
source_type
source_identifier
```

Example:

```json
{
  "company": "Example",
  "source_type": "ashby",
  "source_identifier": "example"
}
```

Admin can override detection.

---

# 14. Scheduling Model

Use three modes.

## Default

```text
24h
```

Suitable for:

- normal companies,
- most ATS feeds,
- analytics-oriented coverage.

## High priority

```text
12h
```

Suitable for:

- fast Web3 boards,
- strategically important companies,
- partner hiring campaigns.

## Manual only

Suitable for:

- experimental crawler,
- source with uncertain terms,
- debugging,
- one-off import.

---

# 15. Suggested Daily Schedule

Example in Vietnam time:

```text
00:30  Company ATS batch A
01:00  Company ATS batch B
01:30  Company ATS batch C

02:00  CryptoJobsList
02:10  web3.career
02:20  We Work Remotely

02:30  Himalayas

03:00  AI cleaning queue
03:30  Quality gate
04:00  Revalidation / expiry
04:30  Market aggregation
```

Exact timing is operational, not user-facing.

Do not run all sources at the exact same minute.

---

# 16. Supabase Scheduling

Recommended orchestration:

```text
Supabase Cron
      ↓
Edge Function / worker trigger
      ↓
Job queue
      ↓
Crawler workers
```

Supabase currently supports scheduled jobs through Cron/pg_cron and can invoke Edge Functions.

However, heavy or long-running crawling should not be packed into one oversized Edge Function invocation.

Use Edge Functions for:

- orchestration,
- small source fetches,
- queue dispatch,
- admin manual trigger.

Use a dedicated worker/process for:

- large source batches,
- long pagination,
- heavy parsing,
- large AI queues.

---

# 17. Admin Manual Trigger

Admin screens must support:

## Source

```text
[Run Source Now]
```

## Company

```text
[Fetch Jobs Now]
```

## Adapter

```text
[Run All Greenhouse Companies]
```

## Whole system

```text
[Run All Enabled Sources]
```

`Run All` should require a confirmation dialog.

Every manual run creates a normal crawler run record.

Do not create a separate execution path.

---

# 18. Full Data Pipeline

```text
SOURCE
  ↓
FETCH
  ↓
RAW STAGING
  ↓
SOURCE VALIDATION
  ↓
HARD FILTER
  ↓
EXACT DEDUP
  ↓
CONTENT HASH
  ↓
NEW / CHANGED ONLY
  ↓
AI CLEANING
  ↓
QUALITY GATE
  ↓
CANONICAL DEDUP
  ↓
PUBLISH / REVIEW / REJECT
  ↓
JOB HISTORY EVENT
  ↓
DAILY ANALYTICS
```

---

# 19. Hard Filter Before AI

Reject or skip without AI when:

```text
missing title
missing company
missing source URL
clearly expired
exact duplicate source_job_id
exact duplicate canonical apply URL
unchanged payload hash
obviously outside the tracked company/job scope
```

This protects AI cost.

---

# 20. Raw Job Staging

Do not write crawler payload directly to the final jobs table.

```sql
create table raw_jobs (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null,
  company_id uuid,

  source_job_id text,

  payload jsonb not null,
  payload_hash text not null,

  fetched_at timestamptz default now(),

  processing_status text default 'pending',

  processed_at timestamptz,
  processing_error text
);
```

Benefits:

- parser replay
- debugging
- model reprocessing
- source-change diagnosis
- auditability

---

# 21. Source Registry

```sql
create table job_sources (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text unique not null,

  source_type text not null,

  base_url text,

  default_crawl_hours integer default 24,

  priority integer default 50,

  enabled boolean default true,

  attribution_required boolean default false,
  attribution_text text,

  canonical_link_required boolean default false,

  redistribution_notes text,

  last_policy_reviewed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

# 22. Companies Table

```sql
create table companies (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text unique not null,

  logo_url text,
  website text,
  careers_url text,

  domains text[] default '{}',

  headquarters text,

  source_type text,
  source_identifier text,
  source_region text,

  crawl_interval_hours integer null, -- null inherits job_sources.default_crawl_hours

  priority integer default 50,

  verified boolean default false,
  active boolean default true,

  last_crawled_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

# 23. Canonical Jobs Table

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,

  title text not null,

  company_id uuid references companies(id),
  company_name text not null,

  description_html text,
  description_plain text,

  summary text,

  job_type text not null check (job_type in ('tech', 'non_tech')),

  primary_role text,
  roles text[] default '{}',

  domains text[] default '{}',

  required_skills text[] default '{}',
  preferred_skills text[] default '{}',
  mentioned_skills text[] default '{}',

  seniority text,

  experience_min_years numeric,
  experience_max_years numeric,

  employment_type text,
  remote_type text,

  location_text text,
  country_codes text[] default '{}',
  regions text[] default '{}',

  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,

  source_id uuid references job_sources(id),
  source_job_id text,

  source_url text,
  canonical_url text,
  apply_url text,

  posted_at timestamptz,
  source_updated_at timestamptz,

  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),

  expires_at timestamptz,

  status text default 'review',

  quality_score numeric,
  classification_confidence numeric,

  classifier_version text,

  input_hash text,
  fingerprint text,

  ranking_score numeric default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

# 24. Skills Registry Table

```sql
create table skills (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  name text not null,

  category text,

  aliases text[] default '{}',

  roadmap_key text,

  active boolean default true,

  created_at timestamptz default now()
);
```

---

# 25. Roles Registry

```sql
create table job_roles (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  name text not null,

  group_name text,

  active boolean default true
);
```

---

# 26. Domain Registry

```sql
create table job_domains (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  name text not null,

  active boolean default true
);
```

---

# 27. Job Source Links

A canonical job may appear in multiple sources.

```sql
create table job_source_links (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references jobs(id) on delete cascade,
  source_id uuid references job_sources(id),

  source_job_id text,
  source_url text,

  discovered_at timestamptz default now(),
  last_seen_at timestamptz default now(),

  unique(source_id, source_job_id)
);
```

---

# 28. Exact Deduplication

Run before AI.

Signals:

## Source identity

```text
source_id + source_job_id
```

## Canonical URL identity

Normalize URL:

- remove UTM params
- remove referral params
- remove tracking query
- normalize host
- normalize trailing slash

## Official apply URL

Same official application URL is a very strong duplicate signal.

---

# 29. Fuzzy Deduplication

Run after normalization/classification.

Fingerprint:

```text
normalized_company
+
normalized_title
+
normalized_location
```

Secondary evidence:

- same employer
- similar title
- same remote region
- description hash similarity
- same ATS job ID in apply URL

Do not use LLM as the primary duplicate engine.

AI can assist only ambiguous review cases.

---

# 30. Canonical Source Priority

Recommended:

```text
1. Official employer ATS
2. Official employer career page
3. Official specialized API
4. Curated job board API
5. Official RSS
6. HTML-derived source
```

If:

```text
Ashby listing
+
web3.career listing
```

represent the same job:

- canonical job uses Ashby data,
- web3.career remains in `job_source_links`,
- attribution rules are honored if its data is displayed.

---

# 31. AI Cleaning Purpose

AI is NOT used for:

- user search
- live filtering
- ranking each request
- user matching
- page rendering

AI is used as an **offline enrichment layer**.

Responsibilities:

1. identify whether the job belongs on Corelia,
2. normalize role,
3. classify domains,
4. extract required skills,
5. extract preferred skills,
6. infer seniority where supported by evidence,
7. extract experience requirement,
8. clean boilerplate,
9. generate short factual summary,
10. estimate quality/confidence,
11. produce analytics metadata.

---

# 32. AI Input

Do not send unnecessary payload.

Recommended input:

```text
title
company
department
team
location
employment type
salary metadata
cleaned description text
source category/tags
company domains
```

Cap extremely long descriptions before sending.

Keep enough content to include:

- responsibilities
- requirements
- preferred qualifications
- location restrictions
- compensation

Remove:

- navigation
- cookie text
- duplicated footer
- repeated company boilerplate where deterministic cleaning is safe

---

# 33. AI Structured Output

Example:

```json
{
  "is_relevant": true,
  "job_type": "tech",
  "primary_role": "backend-engineering",
  "roles": [
    "backend-engineering"
  ],
  "domains": [
    "ai",
    "developer-tools"
  ],
  "required_skills": [
    "python",
    "postgresql",
    "docker"
  ],
  "preferred_skills": [
    "kubernetes",
    "aws"
  ],
  "seniority": "mid",
  "experience_min_years": 2,
  "experience_max_years": null,
  "remote_type": "remote",
  "regions": [
    "APAC"
  ],
  "quality_score": 86,
  "confidence": 0.94,
  "summary": "Backend engineering role building AI developer infrastructure using Python, PostgreSQL and containerized services.",
  "evidence": {
    "required_skills": {
      "python": "Python...",
      "postgresql": "PostgreSQL..."
    },
    "experience_min_years": "2+ years..."
  }
}
```

---

# 34. AI Must Not Invent Metadata

For any extracted field:

```text
required skill
preferred skill
experience
location restriction
salary
```

the model should either:

1. provide supporting evidence from source text, or
2. mark the field as inferred.

Recommended metadata:

```text
value
confidence
evidence
inferred
```

Analytics should prefer evidence-backed values.

---

# 35. AI Classification Table

Keep classification separate from canonical job fields for auditing.

```sql
create table job_classifications (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references jobs(id) on delete cascade,

  input_hash text not null,

  model text,
  classifier_version text not null,

  output jsonb not null,

  quality_score numeric,
  confidence numeric,

  created_at timestamptz default now(),

  unique(job_id, input_hash, classifier_version)
);
```

---

# 36. AI Cost Control

This is mandatory.

Example daily flow:

```text
10,000 jobs fetched
        ↓
8,500 unchanged
        ↓
1,500 candidates
        ↓
600 exact duplicates / irrelevant
        ↓
900 remaining
        ↓
AI only for 900
```

Rules:

```text
payload_hash unchanged
→ no AI

same input_hash + classifier_version
→ no AI

rejected by hard rule
→ no AI
```

---

# 37. AI Reprocessing

Only reprocess when:

```text
job description changed
taxonomy changed materially
classifier_version changed
admin requests reprocess
```

Provide admin:

```text
[Reclassify Job]
[Reclassify Selected]
```

Do not automatically reprocess the whole database when changing a prompt.

Use batch migration when required.

---

# 38. Quality Gate

After AI classification:

```text
PUBLISH
REVIEW
REJECT
```

Example rules:

## Auto publish

```text
is_relevant = true
confidence >= 0.80
quality_score >= 60
official apply URL valid
```

## Needs review

```text
confidence 0.50–0.79
ambiguous role
ambiguous location
suspected duplicate
quality score 40–59
```

## Reject

```text
is_relevant = false
quality < 40
spam
expired
missing essential data
```

Tune thresholds from real data.

---

# 39. Job Status

```text
raw
processing
review
active
rejected
expired
disabled
duplicate
```

---

# 40. Admin Review Inbox

Route:

```text
/admin/jobs/review
```

Card:

```text
Growth Engineer
Company X

AI:
Role: Full Stack Engineering
Domain: SaaS
Skills: React, TypeScript, PostgreSQL
Confidence: 64%

Reason:
Title is ambiguous; responsibilities are primarily engineering.

[Publish]
[Edit]
[Reject]
```

---

# 41. Admin Manual Overrides

Admin must be able to override:

- role
- domains
- skills
- seniority
- location
- salary
- status

Crawler refresh must NOT erase manual correction.

Suggested strategy:

```text
manual_overrides jsonb
```

Canonical projection:

```text
manual value
>
AI value
>
deterministic value
>
source raw value
```

where appropriate.

---

# 42. Job Lifecycle Events

To build hiring trends, do not rely only on current jobs.

```sql
create table job_events (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references jobs(id),

  event_type text not null,

  source_id uuid,

  job_type text,
  role text,
  domains text[],

  required_skills text[],
  preferred_skills text[],

  seniority text,
  remote_type text,

  country_codes text[],
  regions text[],

  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,

  occurred_at timestamptz default now()
);
```

Events:

```text
job_published
job_updated
job_expired
job_reactivated
```

---

# 43. Why Historical Events Matter

If Corelia only stores active jobs:

```text
March:
1,000 jobs

April:
1,200 jobs
```

you cannot tell:

- how many were newly posted,
- how many expired,
- whether new sources were added,
- whether hiring increased.

The market dashboard requires historical state.

---

# 44. Source Coverage History

This is critical.

If Corelia adds 100 companies this month, raw job counts increase even if the real market does not.

Create:

```sql
create table source_coverage_daily (
  date date not null,

  source_id uuid,
  company_id uuid,

  enabled boolean,

  crawl_success boolean,

  active_jobs integer default 0,
  new_jobs integer default 0,

  primary key(date, source_id, company_id)
);
```

---

# 45. Stable-Source Cohort

For growth comparisons, calculate two metrics:

## Observed count

All Corelia data.

Useful for:

```text
How many jobs do we currently have?
```

## Comparable market trend

Only sources/companies that were successfully tracked in both comparison windows.

Useful for:

```text
Is hiring growing?
```

Example:

```text
Current 30d:
sources active in both periods only

vs

Previous 30d:
same source cohort
```

This prevents crawler expansion from creating fake market growth.

---

# 46. Market Analytics Tables

Do not query all raw events for every user request.

Build daily aggregates.

Recommended:

```text
market_daily_stats
market_role_daily_stats
market_skill_daily_stats
market_domain_daily_stats
market_seniority_daily_stats
market_remote_daily_stats
market_location_daily_stats
market_salary_monthly_stats
```

---

# 47. Skill Daily Stats

```sql
create table market_skill_daily_stats (
  date date not null,

  skill text not null,

  role text,
  domain text,

  new_jobs integer default 0,
  active_jobs integer default 0,
  expired_jobs integer default 0,

  required_count integer default 0,
  preferred_count integer default 0,

  comparable_new_jobs integer default 0,
  comparable_total_jobs integer default 0,

  primary key(date, skill, role, domain)
);
```

---

# 48. Role Daily Stats

```sql
create table market_role_daily_stats (
  date date not null,

  role text not null,

  new_jobs integer default 0,
  active_jobs integer default 0,
  expired_jobs integer default 0,

  remote_jobs integer default 0,

  comparable_new_jobs integer default 0,
  comparable_total_jobs integer default 0,

  primary key(date, role)
);
```

---

# 49. Domain Daily Stats

```sql
create table market_domain_daily_stats (
  date date not null,

  domain text not null,

  new_jobs integer default 0,
  active_jobs integer default 0,

  comparable_new_jobs integer default 0,
  comparable_total_jobs integer default 0,

  primary key(date, domain)
);
```

---

# 50. Analytics Refresh

Run after the daily ingestion pipeline.

Example:

```text
02:00 crawl
03:00 cleaning
03:30 publish
04:00 revalidation
04:30 analytics aggregation
```

User-facing analytics only need daily refresh.

No real-time requirement.

---

# 51. Market Metrics

## Active Jobs

```text
count(active jobs)
```

## New Jobs

Count `job_published` events in the period.

## Hiring Growth

Preferred:

```text
comparable new jobs in current window
/
comparable new jobs in previous window
- 1
```

Example:

```text
Current 30d: 1,150
Previous 30d: 1,000

Growth:
+15%
```

---

# 52. Demand Share

Raw counts alone favor large datasets.

For each skill:

```text
Demand Share =
new classified jobs requiring skill
/
all classified jobs in selected cohort
```

Example:

```text
Python:
38% of AI jobs

PostgreSQL:
61% of Backend jobs
```

This is often more useful than raw counts.

---

# 53. Required vs Preferred Skills

Never mix the two.

Show:

```text
PostgreSQL

Required:
61%

Preferred:
13%

Mentioned overall:
74%
```

This tells learners what employers truly require.

---

# 54. Skill Trend

Recommended trend metrics:

```text
Current 30d demand share
vs
Previous 30d demand share
```

and:

```text
Current 30d comparable job count
vs
Previous 30d comparable job count
```

Display both internally.

User-facing growth should prefer demand-share movement when coverage is volatile.

---

# 55. Minimum Sample Size

Do not show growth percentages for tiny samples.

Example rules:

```text
skill trend:
minimum 20 comparable jobs

role trend:
minimum 30 comparable jobs

salary statistic:
minimum 20 salary observations
```

Below threshold:

```text
Not enough data
```

Do not show misleading `+300%` from 1 → 4 jobs.

---

# 56. Smoothing

For trend charts:

- use daily data for 7D/30D,
- optionally use 7-day rolling average,
- use weekly aggregation for 3M/6M,
- use monthly for 1Y+.

Store daily raw aggregates and aggregate at query time or materialized view.

---

# 57. Salary Analytics

Salary is optional because source coverage is incomplete.

Only use employer-disclosed salary where clearly identified.

Keep:

```text
salary_min
salary_max
currency
period
```

Do not mix:

```text
USD/year
USD/month
VND/month
EUR/year
```

until normalized.

---

# 58. Salary Normalization

Optional later layer:

```text
annualized_native_min
annualized_native_max

annualized_usd_min
annualized_usd_max

fx_rate
fx_rate_date
```

Never overwrite raw salary.

For statistics prefer:

```text
median
p25
p75
```

over mean.

---

# 59. Market Dashboard — Main Page

Route:

```text
/jobs/market
```

Suggested cards:

```text
Active Jobs
New Jobs — 30D
Hiring Growth — Comparable Sources
Remote Share
Entry-Level Jobs
```

Then charts:

1. Hiring activity over time
2. Fastest growing roles
3. Most requested skills
4. Fastest growing skills
5. Hiring by domain
6. Seniority distribution
7. Remote vs hybrid vs onsite
8. Regional hiring
9. Salary insights where sample is sufficient

---

# 60. Hiring Activity Chart

Line chart:

```text
New jobs/day
```

Filters:

```text
7D
30D
3M
6M
1Y
```

Toggle:

```text
Observed
Comparable Sources
```

Default:

```text
Comparable Sources
```

when showing growth.

---

# 61. Trending Roles

Example:

```text
AI Engineer          +28%
Data Engineer        +17%
Backend Engineer     +11%
DevOps Engineer       +8%
Frontend Engineer     +2%
```

Use comparable cohort and minimum samples.

Allow role click-through:

```text
/jobs?role=ai-engineering
```

---

# 62. Most In-Demand Skills

Display:

```text
Python
TypeScript
React
AWS
PostgreSQL
Docker
Kubernetes
Go
Rust
```

Each row:

```text
Skill
Job count
Demand share
30d change
```

---

# 63. Skill Detail

Route:

```text
/jobs/market/skills/:skill
```

Example Rust:

```text
Rust hiring trend

Jobs requiring Rust
Required vs preferred
Top roles using Rust
Top domains using Rust
Top locations
Remote share
Related skills
```

Related skill pair examples should come from co-occurrence, not AI opinion.

---

# 64. Role Detail

Route:

```text
/jobs/market/roles/:role
```

Example Backend:

```text
Hiring trend
Active jobs
New jobs
Top required skills
Top preferred skills
Top domains
Remote share
Seniority distribution
Salary distribution
```

---

# 65. Entry-Level Dashboard

This is especially important for Corelia Academy.

Route:

```text
/jobs/market/entry-level
```

Define entry level as:

```text
intern
fresher
junior
```

Show:

- number of openings
- hiring trend
- top roles
- top required skills
- top domains
- remote share
- Vietnam/APAC availability

---

# 66. Remote Market Dashboard

Route:

```text
/jobs/market/remote
```

Show:

```text
Remote share overall
Remote share by role
Remote share by domain
Worldwide vs region-restricted remote
Top remote skills
```

Do not treat:

```text
Remote US only
```

as:

```text
Worldwide remote
```

Store eligibility separately.

---

# 67. Market Insights on Job Pages

Optional later enhancement.

Example:

```text
Market snapshot

Backend Engineering
1,024 active jobs

Most requested skills:
PostgreSQL
AWS
Docker

30-day hiring trend:
+9%
```

No personalized matching needed.

---

# 68. Market Insights on `/jobs`

Small widget:

```text
Trending this month

AI Agents      ↑
Rust           ↑
Data Engineer  ↑

[Explore Market]
```

Keep it secondary to actual job search.

---

# 69. Search

Use PostgreSQL Full Text Search first.

Recommended:

```text
tsvector
+
GIN index
+
structured filters
```

No vector DB required.

No embedding API required.

---

# 70. Search Vector Priority

Weights:

```text
A:
title
company
required skills

B:
preferred skills
role
domains

C:
description
```

PostgreSQL documentation recommends GIN as the preferred full-text-search index type.

---

# 71. Search Query Behavior

Examples:

```text
Rust
Backend Engineer
Solana
React
AI Engineer
Remote APAC
```

Search result ranking:

```text
text relevance
+
freshness
+
source quality
```

Do not use AI reranking.

---

# 72. Job Ranking

Example deterministic score:

```text
Freshness            40
Source Quality       25
Official Source      15
Salary Present        5
Skills Present        5
Good Description      5
Valid Apply URL       5
```

Do not expose the internal score.

---

# 73. Job Card

Show only scan-friendly information:

```text
Logo

Backend Engineer

Company

Remote · APAC · Full-time

AI · Developer Tools

Python · PostgreSQL · Docker

$80k–$120k

Posted 2 days ago
```

Actions:

```text
Save
View Job
```

---

# 74. Job Detail

Sections:

```text
Header

Apply
Save

About the role

Required skills

Preferred skills

Role & Domain

Location / eligibility

Employment type

Seniority

Salary

Company

Source
```

---

# 75. JobPosting Structured Data

Each active job page should emit Schema.org `JobPosting` where source/license policy allows the listing to be published.

Potential fields:

```text
title
datePosted
validThrough
employmentType
hiringOrganization
jobLocation
jobLocationType
applicantLocationRequirements
baseSalary
```

For remote jobs, distinguish work location from applicant eligibility.

---

# 76. Apply Strategy

Corelia should not process job applications in MVP.

Priority:

```text
official employer application URL
```

Fallback:

```text
source canonical URL
```

Always follow source attribution/canonical requirements.

---

# 77. Source Policy Enforcement

Policy should be code-aware.

Example:

```ts
type SourcePolicy = {
  attributionRequired: boolean;
  canonicalLinkRequired: boolean;
  allowDescriptionDisplay: boolean;
  allowSeoIndexing: boolean;
  allowSyndication: boolean;
};
```

Before publishing a source:

```text
policy reviewed
→ enabled
```

Do not assume technical access equals redistribution permission.

---

# 78. User State

```sql
create table user_jobs (
  user_id uuid not null,
  job_id uuid references jobs(id) on delete cascade,

  saved boolean default false,
  applied boolean default false,
  hidden boolean default false,

  saved_at timestamptz,
  applied_at timestamptz,

  primary key(user_id, job_id)
);
```

---

# 79. Admin Pages

```text
/admin/jobs
/admin/jobs/review
/admin/jobs/sources
/admin/jobs/companies
/admin/jobs/crawlers
/admin/jobs/analytics
```

---

# 80. Admin Sources

Show:

```text
Source
Type
Enabled
Cadence
Last Success
Last Error
Jobs Found
Policy Status
```

Actions:

```text
Run Now
Disable
Edit Cadence
View Logs
Edit Policy
```

---

# 81. Admin Companies

Show:

```text
Company
Domains
ATS
Priority
Open Jobs
Last Crawl
Status
```

Actions:

```text
Crawl Now
Edit
Disable
Open Career Page
```

---

# 82. Crawler Runs

```sql
create table crawler_runs (
  id uuid primary key default gen_random_uuid(),

  source_id uuid,
  company_id uuid,

  trigger_type text,

  started_at timestamptz,
  completed_at timestamptz,

  status text,

  fetched_count integer default 0,
  new_raw_count integer default 0,
  unchanged_count integer default 0,
  duplicate_count integer default 0,
  ai_queued_count integer default 0,
  published_count integer default 0,
  review_count integer default 0,
  rejected_count integer default 0,
  failed_count integer default 0,
  expired_count integer default 0,

  error_message text
);
```

`trigger_type`:

```text
scheduled
manual
retry
```

---

# 83. Alerts

Alert when:

```text
source fails 3 consecutive runs
company unexpectedly returns 0 jobs
API schema changes
rate limited repeatedly
AI classification failure spikes
dead link rate increases
```

Delivery can be:

- Discord
- Slack
- email

---

# 84. Revalidation

Discovery and revalidation should be separate jobs.

## Discovery

Find new/changed jobs.

## Revalidation

Check existing active jobs.

If official ATS no longer returns a job:

```text
expire
```

If source provides `validThrough`/expiry:

```text
respect it
```

---

# 85. Freshness Policy

Suggested:

```text
0–7 days
high freshness

8–14 days
normal

15–30 days
lower priority

>30 days
revalidate aggressively
```

Do not automatically delete history.

Set:

```text
status = expired
```

---

# 86. Performance Targets

Initial targets:

```text
/jobs query:
< 500ms DB time

job detail:
< 500ms DB time

market dashboard aggregate query:
< 500ms cached/materialized

no LLM in user request path
```

---

# 87. Data Quality Targets

```text
Normalized role:
>95%

Engineering jobs with >=1 skill:
>85%

Visible duplicate rate:
<2%

Dead apply links:
<5%

Active jobs <=14 days:
>70%

AI low-confidence review rate:
<15% after tuning
```

---

# 88. Analytics Trust Targets

Never publish a chart without:

- clear time window,
- defined population,
- sufficient sample,
- stable-source comparison where growth is claimed.

User-visible language:

Prefer:

```text
Observed in Corelia's tracked sources
```

over:

```text
The entire global job market
```

Corelia data is a sampled market dataset, not a census.

---

# 89. Repo Structure

```text
src/

  features/
    jobs/
      pages/
      components/
      filters/
      hooks/
      api/
      schemas/

    job-market/
      pages/
      charts/
      queries/
      metrics/

  jobs-engine/

    registry/
      roles.ts
      domains.ts
      skills.ts

    sources/
      registry.ts
      policies.ts

    adapters/

      ats/
        greenhouse.ts
        lever.ts
        ashby.ts
        smartrecruiters.ts

      api/
        cryptojobslist.ts
        web3career.ts
        himalayas.ts
        remotive.ts

      rss/
        weworkremotely.ts

      custom/

    ingestion/
      fetch.ts
      raw-store.ts
      hash.ts
      process.ts

    cleaning/
      html.ts
      deterministic.ts

    ai/
      classify.ts
      schema.ts
      prompts.ts
      version.ts

    normalization/
      title.ts
      company.ts
      location.ts
      salary.ts
      role.ts
      skill.ts
      domain.ts

    dedupe/
      url.ts
      fingerprint.ts
      duplicates.ts

    quality/
      gate.ts
      score.ts

    history/
      events.ts

    analytics/
      daily.ts
      comparable-cohort.ts
      skills.ts
      roles.ts
      domains.ts
      salary.ts

  admin/
    jobs/
    sources/
    companies/
    crawlers/
    analytics/

supabase/
  migrations/
  functions/

workers/
  crawl/
  ai/
  analytics/

scripts/
  seed-companies.ts
  run-source.ts
  run-company.ts
  rebuild-analytics.ts
  reclassify-jobs.ts
```

---

# 90. Phase 1 — Foundation

Build:

- taxonomy registry
- source registry
- company registry
- raw jobs
- canonical jobs
- source links
- crawler runs
- job events
- user job state

Deliverable:

```text
database ready
admin can add source/company
```

---

# 91. Phase 2 — ATS Backbone

Implement:

```text
GreenhouseAdapter
LeverAdapter
AshbyAdapter
SmartRecruitersAdapter
```

Seed:

```text
first 100 curated companies
```

Deliverable:

```text
official employer jobs flowing into raw staging
```

---

# 92. Phase 3 — Deterministic Processing

Implement:

- HTML cleanup
- source validation
- URL normalization
- payload hashing
- exact dedup
- company normalization
- title normalization
- source policy enforcement

Deliverable:

```text
new/changed jobs are isolated before AI
```

---

# 93. Phase 4 — AI Cleaning

Implement:

- structured output schema
- role classification
- domain classification
- required/preferred skills
- seniority
- experience requirement
- factual summary
- confidence
- evidence
- quality score
- versioning
- cache by input hash

Deliverable:

```text
AI only runs on eligible new/changed jobs
```

---

# 94. Phase 5 — Quality Gate

Implement:

```text
publish
review
reject
```

Admin review UI.

Deliverable:

```text
no raw unreviewed noise reaches users
```

---

# 95. Phase 6 — Job Board UI

Implement:

```text
/jobs
/jobs/:slug
/jobs/saved
/jobs/applied
/jobs/hidden
```

Filters:

- role
- domain
- skills
- seniority
- work mode
- region
- employment
- posted date
- salary

---

# 96. Phase 7 — Specialized Feeds

Implement:

```text
CryptoJobsList
web3.career
Himalayas
We Work Remotely
```

Then optionally:

```text
Remotive
Remote OK after policy review
```

---

# 97. Phase 8 — Historical Analytics

Implement:

- job events
- source coverage
- daily aggregation
- stable-source cohorts
- market metrics

Deliverable:

```text
30–60 days of reliable trend history begins accumulating
```

The dashboard can launch earlier, but long-period trend labels should only appear when enough history exists.

---

# 98. Phase 9 — Market Dashboard

Implement:

```text
/jobs/market
```

First charts:

1. New job activity
2. Top roles
3. Role growth
4. Top skills
5. Skill growth
6. Domain mix
7. Seniority mix
8. Remote share

---

# 99. Phase 10 — Market Drilldowns

Implement:

```text
/jobs/market/skills/:skill
/jobs/market/roles/:role
/jobs/market/entry-level
/jobs/market/remote
```

---

# 100. Phase 11 — Vietnam Expansion

Build curated Vietnam company registry.

Prefer:

```text
company ATS
official careers
partnership feeds
```

Use ITviec/TopDev for discovery/reference until supported ingestion terms are established.

---

# 101. Phase 12 — SEO

Implement:

```text
/jobs/frontend
/jobs/backend
/jobs/ai-engineering
/jobs/devops

/jobs/skills/react
/jobs/skills/rust
/jobs/skills/python

/jobs/domains/ai
/jobs/domains/web3

/jobs/remote
/jobs/vietnam
/jobs/apac
```

Add:

```text
Schema.org JobPosting
sitemaps
canonical URLs
```

Only index job pages permitted by source policy.

---

# 102. Definition of Done — MVP

Status below reflects the repository implementation. Checked scheduler items
mean the deployable endpoint/configuration exists; production activation still
requires the runtime steps in the implementation baseline.

## Ingestion

- [x] Scheduled crawl every 24h
- [x] Per-source cadence override
- [x] Admin manual crawl
- [x] Raw staging
- [x] Payload hashes
- [x] Exact dedup
- [x] Canonical dedup
- [x] Revalidation through complete ATS feeds
- [x] Expiry

## Sources

- [x] Greenhouse
- [x] Lever
- [x] Ashby
- [x] SmartRecruiters
- [ ] CryptoJobsList
- [ ] web3.career
- [ ] Himalayas
- [ ] We Work Remotely

## AI

- [x] New/changed jobs only
- [x] Structured JSON output
- [x] Evidence
- [x] Role
- [x] Domains
- [x] Required skills
- [x] Preferred skills
- [x] Seniority
- [x] Summary
- [x] Quality
- [x] Confidence
- [x] Versioning
- [x] Hash cache

## Quality

- [x] Publish/review/reject gate
- [x] Manual override
- [x] Source policy checks

## User Job Board

- [x] Search
- [x] Filters
- [x] Job detail
- [x] Apply
- [x] Save
- [x] Applied
- [x] Hide
- [x] Review and restore hidden jobs

## Market Intelligence

- [x] Job events
- [x] Coverage history
- [x] Stable cohort calculations
- [x] Role daily stats
- [x] Skill daily stats
- [x] Domain daily stats
- [x] Remote stats
- [x] Entry-level stats
- [x] Main market dashboard

---

# 103. Recommended First Production Source Mix

Do not target:

```text
30 scraped job boards
```

Target:

```text
4 ATS adapters
+
100–300 curated companies
+
4 structured external feeds
```

This is enough to create a strong job product while keeping:

- quality high,
- duplication lower,
- maintenance manageable,
- legal/source policy easier to reason about.

---

# 104. Key Product Moat

Corelia should not compete on:

> We have every job.

It should compete on:

> We track high-quality technology hiring, clean it into a consistent taxonomy, and show both the jobs and what the market is demanding.

The product becomes:

```text
JOB BOARD
+
TECH HIRING DATA
+
SKILL INTELLIGENCE
```

without needing:

```text
AI job matching
AI CV scoring
AI career chatbot
```

---

# 105. Final System Diagram

```text
                CURATED COMPANIES
                        │
                        ▼
                 COMPANY REGISTRY
                        │
                        ▼
                   ATS DETECTOR
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
   Greenhouse         Lever            Ashby
       │                │                │
       └───────────┬────┴────┬───────────┘
                   │         │
             SmartRecruiters │
                   │         │
                   └────┬────┘
                        │
                OFFICIAL JOB FEEDS
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
 CryptoJobsList    web3.career       Himalayas
       │                │                │
       └────────────────┼────────────────┘
                        │
                 WWR / RSS FEEDS
                        │
                        ▼
                    RAW JOBS
                        │
                        ▼
                 HARD FILTERS
                        │
                        ▼
                 EXACT DEDUP
                        │
                        ▼
              NEW / CHANGED ONLY
                        │
                        ▼
                  AI CLEANING
                        │
                        ▼
                  QUALITY GATE
              ┌─────────┼─────────┐
              ▼         ▼         ▼
           ACTIVE     REVIEW    REJECT
              │
              ▼
         CANONICAL JOBS
              │
       ┌──────┴───────────┐
       ▼                  ▼
    JOB BOARD          JOB EVENTS
                          │
                          ▼
                  DAILY AGGREGATION
                          │
                          ▼
                 STABLE COHORT LOGIC
                          │
                          ▼
                   MARKET INSIGHTS
```

---

# 106. Research Notes / Verified References

The implementation direction above was based on current documentation and current job-board behavior checked in September 2026.

## ATS / Official Job APIs

Greenhouse Job Board API
https://docs.greenhouse.io/job-board.html

Lever Postings API
https://github.com/lever/postings-api

Ashby Public Job Postings API
https://developers.ashbyhq.com/docs/public-job-posting-api

SmartRecruiters Posting API
https://developers.smartrecruiters.com/docs/posting-api
https://developers.smartrecruiters.com/reference/v1listpostings

## Structured Job Feeds

CryptoJobsList API
https://cryptojobslist.com/api-access

web3.career API
https://web3.career/api/v1

Himalayas Remote Jobs API
https://himalayas.app/docs/remote-jobs-api

We Work Remotely RSS
https://weworkremotely.com/remote-job-rss-feed

Remotive API
https://remotive.com/remote-jobs/api

Remote OK
https://remoteok.com/

## Discovery / Market References

Wellfound Jobs
https://wellfound.com/jobs

Y Combinator Jobs
https://www.ycombinator.com/jobs

ITviec
https://itviec.com/it-jobs

TopDev
https://topdev.vn/

roadmap.sh
https://roadmap.sh/
https://roadmap.sh/roadmaps/

## Search / SEO / Scheduling

PostgreSQL Full Text Search / GIN
https://www.postgresql.org/docs/current/gin.html

Schema.org JobPosting
https://schema.org/JobPosting

Supabase Cron
https://supabase.com/docs/guides/cron

Supabase Scheduled Edge Functions
https://supabase.com/docs/guides/functions/schedule-functions

---

# 107. Final Recommendation

Start with this priority:

```text
1. Company Registry
2. Greenhouse
3. Lever
4. Ashby
5. SmartRecruiters
6. Raw staging
7. Dedup + hashes
8. AI cleaning
9. Quality gate
10. Job board
11. CryptoJobsList
12. web3.career
13. Himalayas
14. WWR
15. Job events
16. Stable-source analytics
17. Market dashboard
18. Vietnam expansion
```

The most important architectural rule is:

> **AI understands and cleans each job once; PostgreSQL calculates the market repeatedly.**

This keeps the product scalable:

```text
More users
≠
more AI token cost
```

while still allowing Corelia Jobs to provide a richer utility than a normal job board.
