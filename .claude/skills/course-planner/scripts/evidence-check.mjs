// .claude/skills/course-planner/scripts/evidence-check.mjs
// Trích xuất và kiểm tra mã phản hồi HTTP cùng tính xác thực của câu trích (quote) cho URL bằng chứng trong shortlist, path và evaluation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_USER_AGENT, DEFAULT_REQUEST_TIMEOUT_MS } from "./constants.mjs";

export function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[\u2018\u2019\u201A\u201B']/g, "'") // single quotes
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '"') // double quotes
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractUrlsFromData(data, filePath = "") {
  const items = [];
  const add = (url, field, { kind = undefined, quote = undefined } = {}) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
      items.push({
        url: url.trim(),
        file: filePath,
        field,
        kind,
        quote: typeof quote === "string" ? quote.trim() : quote,
      });
    }
  };

  if (!data || typeof data !== "object") return items;

  // 1. Dạng Backlog (AC-09: mặc định chỉ kiểm tra đề xuất open và chosen)
  if (Array.isArray(data.proposals)) {
    data.proposals.forEach((prop, pIdx) => {
      if (prop?.status && prop.status !== "open" && prop.status !== "chosen") {
        return;
      }
      const pPrefix = `proposals[${pIdx}](${prop?.slug || ""})`;
      if (Array.isArray(prop?.alternatives)) {
        prop.alternatives.forEach((alt, aIdx) => {
          if (alt?.url) add(alt.url, `${pPrefix}.alternatives[${aIdx}].url`);
        });
      }
      if (Array.isArray(prop?.why_now?.urls)) {
        prop.why_now.urls.forEach((u, uIdx) => {
          add(u, `${pPrefix}.why_now.urls[${uIdx}]`, {
            kind: prop?.why_now?.kind,
            quote: prop?.why_now?.quote,
          });
        });
      }
      if (prop?.criteria && typeof prop.criteria === "object") {
        for (const [cKey, cVal] of Object.entries(prop.criteria)) {
          if (Array.isArray(cVal?.refs)) {
            cVal.refs.forEach((r, rIdx) => {
              if (typeof r === "string" && /^https?:\/\//i.test(r)) {
                add(r, `${pPrefix}.criteria.${cKey}.refs[${rIdx}]`);
              }
            });
          }
        }
      }
    });
  }

  // 1b. Dạng Shortlist (legacy/fallback)
  if (Array.isArray(data.shortlist)) {
    data.shortlist.forEach((prop, pIdx) => {
      const pPrefix = `shortlist[${pIdx}](${prop?.slug || ""})`;
      if (Array.isArray(prop?.alternatives)) {
        prop.alternatives.forEach((alt, aIdx) => {
          if (alt?.url) add(alt.url, `${pPrefix}.alternatives[${aIdx}].url`);
        });
      }
      if (Array.isArray(prop?.why_now?.urls)) {
        prop.why_now.urls.forEach((u, uIdx) => {
          add(u, `${pPrefix}.why_now.urls[${uIdx}]`, {
            kind: prop?.why_now?.kind,
            quote: prop?.why_now?.quote,
          });
        });
      }
      if (prop?.criteria && typeof prop.criteria === "object") {
        for (const [cKey, cVal] of Object.entries(prop.criteria)) {
          if (Array.isArray(cVal?.refs)) {
            cVal.refs.forEach((r, rIdx) => {
              if (typeof r === "string" && /^https?:\/\//i.test(r)) {
                add(r, `${pPrefix}.criteria.${cKey}.refs[${rIdx}]`);
              }
            });
          }
        }
      }
    });
  }

  // 2. Dạng Path
  if (Array.isArray(data.evidence)) {
    data.evidence.forEach((ev, idx) => {
      if (Array.isArray(ev?.urls)) {
        ev.urls.forEach((u, uIdx) => {
          add(u, `evidence[${idx}].urls[${uIdx}]`, {
            kind: ev?.kind,
            quote: ev?.quote,
          });
        });
      }
    });
  }

  // 3. Dạng Candidate Evaluation / Skill map
  if (Array.isArray(data.sources)) {
    data.sources.forEach((s, idx) => {
      if (s?.url) {
        add(s.url, `sources[${idx}].url`, {
          quote: s.quote,
        });
      }
    });
  }
  if (Array.isArray(data.why_now?.urls)) {
    data.why_now.urls.forEach((u, idx) => {
      add(u, `why_now.urls[${idx}]`, {
        kind: data?.why_now?.kind,
        quote: data?.why_now?.quote,
      });
    });
  }
  if (Array.isArray(data.evidence)) {
    data.evidence.forEach((ev, idx) => {
      if (Array.isArray(ev?.urls)) {
        ev.urls.forEach((u, uIdx) => {
          add(u, `evidence[${idx}].urls[${uIdx}]`, {
            kind: ev?.kind,
            quote: ev?.quote,
          });
        });
      }
    });
  }
  if (Array.isArray(data.alternatives)) {
    data.alternatives.forEach((alt, idx) => {
      if (alt?.url) add(alt.url, `alternatives[${idx}].url`);
    });
  }

  return items;
}

export function extractUrlsFromFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    console.error(`[evidence-check] File JSON hỏng tại ${filePath}: ${err.message}`);
    process.exit(1);
  }
  return extractUrlsFromData(data, filePath);
}

export async function checkUrls(items, { fetchFn = fetch, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, userAgent = DEFAULT_USER_AGENT } = {}) {
  const results = [];
  const errors = [];

  for (const item of items) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`Timeout sau ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const res = await fetchFn(item.url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const status = res.status;
      const isStatusOk = status >= 200 && status < 300;

      const resultItem = {
        url: item.url,
        file: item.file,
        field: item.field,
        kind: item.kind,
        quote: item.quote,
        status,
        ok: isStatusOk,
      };

      if (!isStatusOk) {
        resultItem.error = `HTTP status ${status}`;
        errors.push(resultItem);
        results.push(resultItem);
        continue;
      }

      // Trích xuất nội dung body HTML để kiểm tra quote
      let rawBody = "";
      try {
        if (typeof res.text === "function") {
          rawBody = await res.text();
        } else if (typeof res.body === "string") {
          rawBody = res.body;
        } else {
          rawBody = "<html><body>Standard page text content</body></html>";
        }
      } catch (err) {
        resultItem.ok = false;
        resultItem.error = `Không đọc được nội dung phản hồi: ${err.message}`;
        errors.push(resultItem);
        results.push(resultItem);
        continue;
      }

      const strippedText = stripHtml(rawBody);
      const trimmedText = strippedText.trim();

      // Kiểm tra trang rỗng sau khi bỏ thẻ HTML (trang cần JavaScript)
      if (trimmedText.length === 0) {
        resultItem.ok = false;
        resultItem.error = `Trang rỗng sau khi bỏ thẻ HTML (có thể yêu cầu JavaScript để hiển thị nội dung)`;
        errors.push(resultItem);
        results.push(resultItem);
        continue;
      }

      // Kiểm tra quote cho bằng chứng kind: "direct"
      if (item.kind === "direct") {
        if (!item.quote || typeof item.quote !== "string" || !item.quote.trim()) {
          resultItem.ok = false;
          resultItem.error = `Bằng chứng kind: "direct" thiếu quote bắt buộc`;
          errors.push(resultItem);
          results.push(resultItem);
          continue;
        }

        const normQuote = normalizeText(item.quote);
        const normPage = normalizeText(strippedText);

        if (!normPage.includes(normQuote)) {
          resultItem.ok = false;
          resultItem.error = `Quote không có trong nội dung trang: "${item.quote}"`;
          errors.push(resultItem);
          results.push(resultItem);
          continue;
        }
      }

      // kind: "inferred" hoặc URL thông thường không bắt buộc quote
      resultItem.ok = true;
      results.push(resultItem);
    } catch (err) {
      clearTimeout(timer);
      const errorItem = {
        url: item.url,
        file: item.file,
        field: item.field,
        kind: item.kind,
        quote: item.quote,
        status: null,
        ok: false,
        error: err.message || String(err),
      };
      errors.push(errorItem);
      results.push(errorItem);
    }
  }

  return {
    ok: errors.length === 0,
    total: results.length,
    passed: results.length - errors.length,
    failed: errors.length,
    errors,
    results,
  };
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error("Cách dùng: node evidence-check.mjs <file-hoặc-thư-mục>");
    process.exit(1);
  }

  const resolved = path.resolve(targetPath);
  let files = [];
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      files = fs.readdirSync(resolved)
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.join(resolved, f));
    } else {
      files = [resolved];
    }
  } else {
    console.error(`Không tìm thấy đường dẫn: ${resolved}`);
    process.exit(1);
  }

  let allItems = [];
  for (const f of files) {
    allItems = allItems.concat(extractUrlsFromFile(f));
  }

  console.log(`[evidence-check] Tìm thấy ${allItems.length} URLs từ ${files.length} file.`);
  checkUrls(allItems)
    .then((res) => {
      if (!res.ok) {
        console.error(`[evidence-check] THẤT BẠI: ${res.failed}/${res.total} URL kiểm tra không đạt:`);
        for (const err of res.errors) {
          console.error(`  - [${err.status || "ERR"}] ${err.url}`);
          console.error(`    tại: ${err.file} (${err.field})`);
          if (err.error) console.error(`    chi tiết: ${err.error}`);
        }
        process.exit(1);
      } else {
        console.log(`[evidence-check] ĐẠT: Toàn bộ ${res.total} URL đều trả mã 2xx và bằng chứng hợp lệ.`);
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error(`[evidence-check] Lỗi hệ thống:`, err);
      process.exit(1);
    });
}
