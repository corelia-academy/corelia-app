// Tổng hợp chi phí đo được từ run-log.jsonl theo bước và model.
// Chỉ cộng số liệu thật child báo về (--tokens, --tool-uses, --duration-ms); lượt thiếu số được đếm riêng, không ước lượng.
import fs from "node:fs";
import path from "node:path";

function readEntries(dir) {
  const file = path.join(path.resolve(dir), "run-log.jsonl");
  if (!fs.existsSync(file)) return [];
  const entries = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // bỏ dòng hỏng, không làm hỏng báo cáo
    }
  }
  return entries;
}

const keyOf = (e) => [e.step, e.lesson_id ?? "-", e.role, e.model].join("|");

export function summarizeRunLog(dir) {
  const entries = readEntries(dir);
  const openStarts = new Map();
  const groups = new Map();
  let openCalls = 0;

  for (const e of entries) {
    if (e.action === "start") {
      const k = keyOf(e);
      if (!openStarts.has(k)) openStarts.set(k, []);
      openStarts.get(k).push(Date.parse(e.timestamp));
      continue;
    }
    if (e.action !== "end") continue;

    const starts = openStarts.get(keyOf(e));
    const startedAt = starts && starts.length > 0 ? starts.pop() : null;
    const wall = startedAt != null ? Date.parse(e.timestamp) - startedAt : null;

    const gKey = [e.step, e.role, e.model].join("|");
    if (!groups.has(gKey)) {
      groups.set(gKey, {
        step: e.step, role: e.role, model: e.model,
        calls: 0, measured_calls: 0, tokens: 0, tool_uses: 0, duration_ms: 0, retries: 0,
      });
    }
    const g = groups.get(gKey);
    g.calls++;
    if (Number.isFinite(e.tokens)) {
      g.measured_calls++;
      g.tokens += e.tokens;
    }
    if (Number.isFinite(e.tool_uses)) g.tool_uses += e.tool_uses;
    const duration = Number.isFinite(e.duration_ms) ? e.duration_ms : wall;
    if (Number.isFinite(duration) && duration >= 0) g.duration_ms += duration;
    if (e.result === "needs_fix" || e.result === "rerun") g.retries++;
  }

  for (const starts of openStarts.values()) openCalls += starts.length;

  const rows = [...groups.values()].sort((a, b) => String(a.step).localeCompare(String(b.step), "en", { numeric: true }));
  const totals = rows.reduce(
    (t, r) => ({
      calls: t.calls + r.calls,
      measured_calls: t.measured_calls + r.measured_calls,
      tokens: t.tokens + r.tokens,
      tool_uses: t.tool_uses + r.tool_uses,
      duration_ms: t.duration_ms + r.duration_ms,
      retries: t.retries + r.retries,
    }),
    { calls: 0, measured_calls: 0, tokens: 0, tool_uses: 0, duration_ms: 0, retries: 0 }
  );
  return { rows, totals, open_calls: openCalls };
}

const fmtSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function renderCostSection(summary) {
  const { rows, totals, open_calls } = summary;
  if (rows.length === 0) return ["- Chưa có lượt child nào kết thúc trong run-log.jsonl."];
  const lines = [
    "| Bước | Role | Model | Lượt | Có số token | Token | Tool call | Thời gian | Chạy lại |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    lines.push(`| ${r.step} | ${r.role} | ${r.model} | ${r.calls} | ${r.measured_calls}/${r.calls} | ${r.tokens} | ${r.tool_uses} | ${fmtSeconds(r.duration_ms)} | ${r.retries} |`);
  }
  lines.push(`| **Tổng** | | | ${totals.calls} | ${totals.measured_calls}/${totals.calls} | ${totals.tokens} | ${totals.tool_uses} | ${fmtSeconds(totals.duration_ms)} | ${totals.retries} |`);
  lines.push("");
  lines.push("- Chỉ cộng số liệu child báo về. Lượt thiếu số token không được ước lượng; cột \"Có số token\" cho biết độ phủ của tổng.");
  lines.push("- Không gồm chi phí của coordinator.");
  if (open_calls > 0) lines.push(`- ${open_calls} lượt có \`start\` nhưng chưa có \`end\` (bỏ qua khi cộng).`);
  return lines;
}
