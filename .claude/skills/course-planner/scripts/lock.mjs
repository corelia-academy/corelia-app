// .claude/skills/course-planner/scripts/lock.mjs
// Khóa liên tiến trình trên cùng một máy cho các file dùng chung khi nhiều app chạy song song.
// Khóa là một thư mục: mkdirSync là thao tác nguyên tử, chỉ một tiến trình tạo được.
// Khóa quá hạn (tiến trình chết giữa chừng) được gỡ khi mtime cũ hơn staleMs.
import fs from "node:fs";
import path from "node:path";

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function lockDir(repoRoot, name) {
  return path.join(path.resolve(repoRoot), ".course-plan", ".locks", name);
}

// Giành khóa; trả về hàm release. Ném lỗi khi chờ quá timeoutMs.
export function acquireLock(dir, { timeoutMs = 60_000, staleMs = 120_000, pollMs = 50, owner = "" } = {}) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(
        path.join(dir, "owner.json"),
        JSON.stringify({ pid: process.pid, owner, at: new Date().toISOString() }) + "\n",
      );
      let released = false;
      return () => {
        if (released) return;
        released = true;
        fs.rmSync(dir, { recursive: true, force: true });
      };
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      let age = 0;
      try {
        age = Date.now() - fs.statSync(dir).mtimeMs;
      } catch {
        continue; // khóa vừa được gỡ, thử lại ngay
      }
      if (age > staleMs) {
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) {
        let holder = "";
        try {
          holder = fs.readFileSync(path.join(dir, "owner.json"), "utf8").trim();
        } catch {}
        throw new Error(`Hết thời gian chờ khóa ${dir}${holder ? ` (đang giữ: ${holder})` : ""}`);
      }
      sleepSync(pollMs);
    }
  }
}

export function withLock(dir, fn, opts) {
  const release = acquireLock(dir, opts);
  try {
    return fn();
  } finally {
    release();
  }
}

export async function withLockAsync(dir, fn, opts) {
  const release = acquireLock(dir, opts);
  try {
    return await fn();
  } finally {
    release();
  }
}

// Ghi file qua file tạm rồi rename, để tiến trình khác không đọc phải file ghi dở.
export function writeFileAtomic(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

export function writeJsonAtomic(file, data) {
  writeFileAtomic(file, JSON.stringify(data, null, 2) + "\n");
}
