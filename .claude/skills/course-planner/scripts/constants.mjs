// .claude/skills/course-planner/scripts/constants.mjs
// Các hằng số định mức và tiêu chí dùng chung cho shortlist, lint và xếp hạng

export const SHORTLIST_MIN_PROPOSALS = 4;
export const SHORTLIST_MAX_PROPOSALS = 6;
export const SHORTLIST_MIN_DIRECTIONS = 3;
export const SHORTLIST_MIN_ALTERNATIVES = 2;

export const BACKLOG_MIN_OPEN_PROPOSALS = 4;
export const BACKLOG_MAX_OPEN_PROPOSALS = 6;
export const BACKLOG_MIN_DIRECTIONS = 3;
export const VALID_PROPOSAL_STATUSES = new Set(["open", "chosen", "rejected", "produced"]);

export const SHORTLIST_CRITERIA_KEYS = [
  "continues_catalog",
  "fills_direction",
  "timely",
  "differentiated",
  "showable_product",
];

export const PROMISE_FORBIDDEN_PREFIX = /^(hiểu|nắm|biết|tìm hiểu|làm quen)\b/i;

export const VALID_AXES = new Set(["role", "skill", "ecosystem"]);

export const MAP_KINDS = new Set(["ecosystem", "role", "skill"]);

export const MAP_LAYERS = {
  ecosystem: ["foundation", "language", "core", "branch"],
  role: ["foundation", "competency", "production"],
  skill: ["fundamentals", "core", "production", "integration"],
};

export const MAP_STATUSES = new Set(["draft", "approved"]);

export const MAP_COVERAGE_STATUSES = new Set(["empty", "partial", "covered"]);

export const KNOWN_BAD_TOOLS = {
  "solana-cli": "solana",
  "anchor-cli": "anchor",
  "rust": "rustc",
};

export const TOOL_NAME_REGEX = /^[a-z0-9][a-z0-9_-]*$/;

export const VALID_FINAL_ASSIGNMENT_FIELDS = new Set([
  "github_url",
  "deployment_url",
  "contract_address",
  "transaction_url",
  "demo_url",
  "notes",
]);

export const KNOWN_BAD_ASSIGNMENT_FIELDS = new Set([
  "testnet_tx_hash",
  "deployed_url",
]);

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
