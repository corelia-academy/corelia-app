# Route/state audit

| Route | Observed state/source | Responsive measurements |
| --- | --- | --- |
| `/jobs` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/hackathons` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/courses/solidity-developer` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/courses` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/career` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/career/unihackfest-2026` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/projects` | Real empty catalog | 10/10 width/theme combinations; no measured overflow |
| `/jobs/market` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/search` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/login` | Guest login form; no submit | 10/10 width/theme combinations; no measured overflow |
| `/verify` | Initial verification form; no certificate token | 10/10 width/theme combinations; no measured overflow |
| `/hackathons/unihackfest-2026/overview` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/hackathons/unihackfest-2026/prizes` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/hackathons/unihackfest-2026/timeline` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/hackathons/unihackfest-2026/resources` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/hackathons/unihackfest-2026/projects` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/instructors/b9f892ee-f620-41c3-ac7b-21b4818b29d4` | Live public data | 10/10 width/theme combinations; no measured overflow |
| `/jobs/affirm-senior-software-engineer-backend-recoveries-7fce435b89` | Live public data | 10/10 width/theme combinations; no measured overflow |

| Additional route/state | Status |
| --- | --- |
| Public instructor VI→EN | Live language switch verified; existing translated courses changed without reload |
| `/@corelia.edu` | Live public profile identity/activity/privacy states observed; embedded instructor-course cache plumbing reviewed |
| Projects populated cards | Local fixture; no server project created |
| Projects populated detail | Layout updated; populated data fixture QA pending |
| Course long title/broken image/progress | Local fixture |
| Curriculum first open/second closed | Live course and fixture |
| Learn guest guard | Nonexistent course ID redirects to Login; no learning operation |
| Account/Feed/Jobs personal/Admin/Teaching | Explicit presentation boundary tests; authenticated runtime QA pending |
| Confirm signup/reset/invite/claim/unsubscribe/verify outcome states | Scoped styles; token-dependent visual QA pending; no real actions |
| Filtered Jobs landings | Reuse catalog; every individual taxonomy route not separately visited |
| Loading/error/retry states | Source review and existing tests; forced-network visual matrix pending |
