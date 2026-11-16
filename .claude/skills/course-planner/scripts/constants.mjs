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

// Ràng buộc quy mô khóa học gom nhiều ô của map (AC-01 -> AC-07)
export const COURSE_MIN_NODES = 3;
export const COURSE_MAX_NODES = 7;
export const MAX_OPEN_PROPOSALS_PER_MAP = 2;
export const MIN_MAPS_WITH_OPEN_PROPOSALS = 3;

// Danh sách từ khóa nhận diện ô công cụ/môi trường (V-12: bỏ các từ khóa chung chung, chỉ giữ từ khóa cài đặt/công cụ)
export const TOOLING_KEYWORDS = [
  "cài đặt",
  "cấu hình môi trường",
  "setup",
  "install",
  "installation",
  "tooling",
];

export function matchesToolingKeyword(text, keyword) {
  if (!text || typeof text !== "string") return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, "iu");
  return regex.test(text);
}

// Hành động quan sát được theo P1 cho outcome của module
export const P1_OBSERVABLE_ACTIONS = [
  "dự đoán",
  "giải thích",
  "chẩn đoán",
  "chọn",
  "thiết kế",
];
export const P1_CODE_ACTIONS = ["viết", "sửa"];

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

export function getFocusEntries(focusObj) {
  if (!focusObj || typeof focusObj !== "object") return null;
  const rawList = Array.isArray(focusObj.paths)
    ? focusObj.paths
    : (typeof focusObj.path === "string" && focusObj.path.trim() ? [focusObj.path.trim()] : []);

  const entries = [];
  for (const item of rawList) {
    if (typeof item === "string" && item.trim()) {
      entries.push({ path: item.trim() });
    } else if (item && typeof item === "object" && typeof item.path === "string" && item.path.trim()) {
      entries.push({
        path: item.path.trim(),
        kind: typeof item.kind === "string" && item.kind.trim() ? item.kind.trim() : undefined,
        entry: typeof item.entry === "string" && item.entry.trim() ? item.entry.trim() : undefined,
      });
    }
  }
  return entries.length > 0 ? entries : null;
}

export function getFocusPaths(focusObj) {
  const entries = getFocusEntries(focusObj);
  if (!entries) return null;
  return entries.map((e) => e.path);
}
