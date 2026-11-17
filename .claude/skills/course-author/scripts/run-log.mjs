// Ghi log lần chạy child agent vào run-log.jsonl.
// Chạy: node run-log.mjs <thư-mục-khóa> <step> <lesson_id|-> <role> <model> <start|end> [result]
//        [--tokens N] [--tool-uses N] [--duration-ms N]
// Ba cờ đo chi phí chỉ dùng với `end`, lấy từ số liệu child báo về; không có số thì bỏ cờ, không ước lượng.
import fs from "node:fs";
import path from "node:path";

const MEASURE_FLAGS = new Map([
  ["--tokens", "tokens"],
  ["--tool-uses", "tool_uses"],
  ["--duration-ms", "duration_ms"],
]);

function fail(message) {
  console.error(`[run-log] ${message}`);
  process.exit(1);
}

const positional = [];
const measures = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const field = MEASURE_FLAGS.get(args[i]);
  if (!field) {
    positional.push(args[i]);
    continue;
  }
  const raw = args[++i];
  const value = Number(raw);
  if (raw === undefined || !Number.isInteger(value) || value < 0) {
    fail(`${args[i - 1]} cần một số nguyên không âm (nhận: ${raw})`);
  }
  measures[field] = value;
}

const dir = path.resolve(positional[0] ?? ".");
const step = positional[1] ?? "-";
const lessonIdArg = positional[2] ?? "-";
const role = positional[3] ?? "-";
const model = positional[4] ?? "-";
const action = positional[5] ?? "start"; // start | end
const result = positional[6] ?? null;

if (Object.keys(measures).length > 0 && action !== "end") {
  fail("các cờ đo chi phí chỉ hợp lệ với action `end`");
}

const logFile = path.join(dir, "run-log.jsonl");

const entry = {
  timestamp: new Date().toISOString(),
  step: isNaN(Number(step)) ? step : Number(step),
  lesson_id: lessonIdArg === "-" ? null : lessonIdArg,
  role,
  model,
  action,
  result: result ?? null,
  ...measures,
};

fs.appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf8");
