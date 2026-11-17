// In bảng chi phí đo được của một lần sản xuất khóa.
// Chạy: node cost-summary.mjs <thư-mục-khóa>
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeRunLog, renderCostSection } from "./cost-lib.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const dir = process.argv[2] ?? ".";
  console.log(renderCostSection(summarizeRunLog(dir)).join("\n"));
}
