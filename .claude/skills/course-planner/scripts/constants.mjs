// .claude/skills/course-planner/scripts/constants.mjs
// Các hằng số định mức và tiêu chí dùng chung cho shortlist, lint và xếp hạng

export const SHORTLIST_MIN_PROPOSALS = 4;
export const SHORTLIST_MAX_PROPOSALS = 6;
export const SHORTLIST_MIN_DIRECTIONS = 3;
export const SHORTLIST_MIN_ALTERNATIVES = 2;

export const SHORTLIST_CRITERIA_KEYS = [
  "continues_catalog",
  "fills_direction",
  "timely",
  "differentiated",
  "showable_product",
];

export const PROMISE_FORBIDDEN_PREFIX = /^(hiểu|nắm|biết|tìm hiểu|làm quen)\b/i;

export const VALID_AXES = new Set(["role", "skill", "ecosystem"]);

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
