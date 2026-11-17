import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const rootDir = path.resolve(".");
const scriptsDir = path.join(rootDir, ".claude/skills/course-author/scripts");

function run(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

test("AC3.3 / W-01: lesson-context chạy cho mọi lesson, JSON hợp lệ; L2-1 có đúng 4 key points; mọi bài có sources đều có key points; open_questions có mặt", () => {
  const runs = [
    { dir: ".claude/skills/course-author/test/fixtures/course-a", isCourseA: true },
    { dir: ".claude/skills/course-author/test/fixtures/course-b", isCourseA: false },
  ];

  for (const { dir, isCourseA } of runs) {
    const curr = JSON.parse(fs.readFileSync(path.join(rootDir, dir, "curriculum.json"), "utf8"));
    const resSize = fs.statSync(path.join(rootDir, dir, "research.json")).size;
    const currSize = fs.statSync(path.join(rootDir, dir, "curriculum.json")).size;
    const totalBase = resSize + currSize;

    let totalCtxSize = 0;
    let count = 0;

    for (const m of curr.modules) {
      for (const l of m.lessons) {
        const res = run(`node ${path.join(scriptsDir, "lesson-context.mjs")} ${dir} ${l.lesson_id}`);
        assert.equal(res.status, 0, `Lỗi khi chạy lesson-context cho ${l.lesson_id} tại ${dir}`);

        const ctx = JSON.parse(res.stdout);
        assert.ok(ctx.lesson, `Lesson ${l.lesson_id} thiếu trường lesson`);
        assert.ok(ctx.module, `Lesson ${l.lesson_id} thiếu trường module`);
        assert.ok(Array.isArray(ctx.outcomes), `Lesson ${l.lesson_id} outcomes không phải mảng`);
        assert.ok(ctx.research, `Lesson ${l.lesson_id} thiếu research`);
        assert.ok(Array.isArray(ctx.research.open_questions), `Lesson ${l.lesson_id} thiếu open_questions`);
        assert.ok(Array.isArray(ctx.research.prerequisites), `Lesson ${l.lesson_id} thiếu prerequisites`);

        let kpCount = 0;
        for (const t of ctx.research.topics ?? []) {
          kpCount += (t.key_points ?? []).length;
        }

        if (l.source_ids?.length > 0) {
          assert.ok(
            kpCount >= 1,
            `Lesson ${l.lesson_id} tại ${dir} có source_ids nhưng không có key point nào`
          );
        }

        if (isCourseA && l.lesson_id === "L2-1") {
          assert.equal(kpCount, 4, `L2-1 trên fixture course-a phải có đúng 4 key points, thực tế: ${kpCount}`);

          // V-07: Chứng minh trực tiếp hành vi lọc context (loại bỏ topic và source không liên quan)
          const returnedTopicIds = (ctx.research.topics ?? []).map((t) => t.topic_id);
          assert.ok(returnedTopicIds.includes("T01"), "Context của L2-1 phải chứa topic liên quan T01");
          assert.ok(!returnedTopicIds.includes("T02"), "Context của L2-1 không được chứa topic không liên quan T02");

          const returnedSourceIds = (ctx.research.sources ?? []).map((s) => s.source_id);
          assert.ok(returnedSourceIds.includes("S01"), "Context của L2-1 phải chứa source liên quan S01");
          assert.ok(!returnedSourceIds.includes("S02"), "Context của L2-1 không được chứa source không liên quan S02");

          const allKpTexts = (ctx.research.topics ?? []).flatMap((t) => (t.key_points ?? []).map((kp) => kp.text));
          assert.ok(allKpTexts.includes("Khái niệm 1"), "Context của L2-1 phải chứa key point của topic T01");
          assert.ok(!allKpTexts.includes("Kiến thức riêng của topic B không liên quan"), "Context của L2-1 không được chứa key point của topic không liên quan T02");
        }

        const sz = Buffer.byteLength(res.stdout, "utf8");
        totalCtxSize += sz;
        count++;
      }
    }

    const avgSize = Math.round(totalCtxSize / count);
    assert.ok(
      avgSize > 0 && avgSize < 5000,
      `Kích thước trung bình ${avgSize} nằm ngoài khoảng mong đợi`
    );
  }
});

test("AC3.4: test run-log.mjs: hai lần gọi start/end tạo hai dòng JSON hợp lệ có timestamp tăng dần", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-log-test-"));

  // Lần 1: start
  const res1 = run(`node ${path.join(scriptsDir, "run-log.mjs")} ${tmpDir} 5 L1-1 lesson sonnet start`);
  assert.equal(res1.status, 0);

  // Đợi 20ms để timestamp tăng
  await new Promise((r) => setTimeout(r, 20));

  // Lần 2: end
  const res2 = run(`node ${path.join(scriptsDir, "run-log.mjs")} ${tmpDir} 5 L1-1 lesson sonnet end ok`);
  assert.equal(res2.status, 0);

  const logFile = path.join(tmpDir, "run-log.jsonl");
  assert.ok(fs.existsSync(logFile), "run-log.jsonl không tồn tại");

  const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);

  const entry1 = JSON.parse(lines[0]);
  const entry2 = JSON.parse(lines[1]);

  assert.equal(entry1.step, 5);
  assert.equal(entry1.lesson_id, "L1-1");
  assert.equal(entry1.action, "start");
  assert.equal(entry1.result, null);

  assert.equal(entry2.step, 5);
  assert.equal(entry2.lesson_id, "L1-1");
  assert.equal(entry2.action, "end");
  assert.equal(entry2.result, "ok");

  const time1 = new Date(entry1.timestamp).getTime();
  const time2 = new Date(entry2.timestamp).getTime();
  assert.ok(time2 >= time1, `Timestamp không tăng dần: ${entry1.timestamp} -> ${entry2.timestamp}`);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AC3.5 / W-05: grep trong course-author/** không còn tham chiếu roles/05-lesson.md hay roles/06-lesson-review.md đơn", () => {
  function walk(d) {
    let files = [];
    for (const f of fs.readdirSync(d)) {
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
      else files.push(full);
    }
    return files;
  }

  const allFiles = walk(path.join(rootDir, ".claude/skills/course-author")).filter(
    (f) => !f.includes(path.sep + "test" + path.sep)
  );
  const occurrences = [];

  for (const f of allFiles) {
    const content = fs.readFileSync(f, "utf8");
    const lines = content.split("\n");
    lines.forEach((l, idx) => {
      if (l.includes("roles/05-lesson.md") || l.includes("roles/06-lesson-review.md")) {
        occurrences.push({ file: path.relative(rootDir, f), line: idx + 1, text: l.trim() });
      }
    });
  }

  // W-05: Dòng 89 của SKILL.md đã được cập nhật sang roles/05-lesson/video.md; không còn bất kỳ tham chiếu đơn nào
  assert.equal(
    occurrences.length,
    0,
    `Vẫn còn các tham chiếu cũ: ${JSON.stringify(occurrences, null, 2)}`
  );
});

test("W-02: mỗi dòng > 25 ký tự của 2 file gốc xuất hiện nguyên văn trong ít nhất một file mới (trừ các ngoại lệ hợp lệ)", () => {
  const orig05Path = path.join(rootDir, ".claude/skills/course-author/test/orig_05.md");
  const orig06Path = path.join(rootDir, ".claude/skills/course-author/test/orig_06.md");
  assert.ok(fs.existsSync(orig05Path), "Thiếu orig_05.md");
  assert.ok(fs.existsSync(orig06Path), "Thiếu orig_06.md");

  const orig05 = fs.readFileSync(orig05Path, "utf8").split("\n");
  const orig06 = fs.readFileSync(orig06Path, "utf8").split("\n");

  const newFiles = [
    ...fs.readdirSync(path.join(rootDir, ".claude/skills/course-author/roles/05-lesson")).map(f => path.join(rootDir, ".claude/skills/course-author/roles/05-lesson", f)),
    ...fs.readdirSync(path.join(rootDir, ".claude/skills/course-author/roles/06-lesson-review")).map(f => path.join(rootDir, ".claude/skills/course-author/roles/06-lesson-review", f)),
  ];

  const newContents = newFiles.map(f => fs.readFileSync(f, "utf8")).join("\n");

  const allowedExceptions05 = new Set([
    // L91 & L95: Đổi đường dẫn roles/06-lesson-review.md sang thư mục mới
    "Trước khi báo hoàn tất, tự review bài như một reviewer độc lập, theo đúng bảng tiêu chí và danh sách luôn-`blocking` trong `roles/06-lesson-review.md`. Không giao bài chưa qua bước này.",
    "3. Duyệt từng tiêu chí trong bảng của `roles/06-lesson-review.md` và từng mục luôn-`blocking`. Chỗ nào vi phạm thì sửa bài, không ghi chú để reviewer bắt.",
    // L39-L45: Hợp đồng mới cho video lesson (dạy chính, primary fit, outline/range evidence, article tự đủ bỏ mức 80-200 từ)
    "- Chọn đúng một ứng viên trong `research.videos` thuộc topic khớp nhất với lesson; lấy ứng viên có `rank` nhỏ nhất còn dùng được. Chỉ xuống rank sau khi ứng viên trước không nhúng được hoặc không khớp kênh.",
    "- Chọn đoạn phát bằng `scripts/studio/youtube-captions.ts` (xem `platform.md`). Lấy `start_seconds`, `end_seconds` từ đúng một match rõ ràng, chép `video_id`, `language`, `track` và `start_seconds`, `end_seconds`, `cue_count`, `cue_text_sha256` của match vào `caption_evidence`. Một match dài tối đa 45 giây, đủ cho một ý nhỏ. Khi bài cần một đoạn dạy trọn một ý dài hơn (tối đa khoảng 3 phút): dùng match làm điểm xuất phát, đọc transcript quanh đó để chọn ranh giới đầu và cuối đúng chỗ ý bắt đầu và kết thúc, rồi chạy `youtube-captions.ts --url <URL> --range <start>-<end>` và chép kết quả của lệnh đó (không tự tính) vào `caption_evidence`; start và end của bài bằng start và end trong kết quả. Không đoán timestamp. Khi không có match rõ:",
    "- Curriculum không đòi đoạn cắt: dùng `0/0` (phát toàn bộ) và `caption_evidence: null`.",
    "- Curriculum đòi dừng trước nội dung chưa dạy: tìm điểm dừng bằng cue caption đầu tiên nhắc khái niệm chưa dạy (đưa khái niệm đó vào `--query` của `youtube-captions.ts`). Không xác định được thì thử ứng viên kế tiếp của topic. Hết ứng viên thì viết lesson dạng article đầy đủ, `video: null`, và ghi lý do vào báo cáo cho coordinator. Không phát toàn bộ khi toàn bộ video chứa nội dung chưa dạy, và không hỏi user để xác nhận mốc.",
    "- `description_markdown` dưới video gồm: phần mở bài như bài dạy, `## Mục tiêu` (1–2 mục), `## Tóm lược kiến thức`, một dòng ghi kênh gốc. `## Tóm lược kiến thức` là một article gọn về đúng kiến thức của video: khoảng 80–200 từ, có thể kèm một đoạn code ngắn hoặc một bảng nhỏ, lấy từ nguồn research, và người bỏ video vẫn hiểu trọn ý. Không chép transcript, không khẳng định \"video đã nói X\".",
    "- Mọi ứng viên đều không nhúng được thì viết lesson dạng article đầy đủ (kèm sơ đồ) và để khối `video` là `null`.",
    // L51-L52: Quiz bỏ tiêu chí độ dài phương án; thay bằng câu hỏi có thật, nhiễu có cơ sở, độ khó loại trừ được (roles/05-lesson/quiz.md)
    // L3, L17: Giọng văn và Gọi tên bài chuyển từ principles.md (bản của trang live, không sửa) sang references/writing.md
    "Viết MỘT lesson theo `curriculum.json`. Dùng đúng `lesson_id`, `type`, `purpose`, `code_mode`, `outcome_ids`, `completion_rule` của lesson trong curriculum. Viết tiếng Việt theo mục Giọng văn trong `principles.md`. Không hứa kiểm điều loại bài không kiểm được (`platform.md`).",
    "- Mở bài theo mục Mở bài dạy trong `principles.md`: \"Trước khi bắt đầu\", rồi tình huống và câu hỏi, rồi trả lời câu hỏi, rồi khái niệm. Kết thúc bài bằng việc giải quyết trọn tình huống mở bài. Phần \"Trước khi bắt đầu\" trỏ tới bài trong khóa bằng nhãn của app (xem mục Gọi tên bài và phần trong `principles.md`, nhãn lấy từ bảng nhãn coordinator đưa), tới nguồn ngoài bằng URL đã đọc. Không đưa `lesson_id`, `module_id` hay `source_ids` vào chữ người học.",
    "- Phương án nhiễu lấy từ `misconceptions`.",
    "- Các phương án của một câu có độ dài và mức chi tiết tương đương: đáp án đúng không dài hơn nhiễu, và vị trí đáp án đúng trải đều trong cả bài (không để người học đoán theo độ dài hay vị trí).",
  ]);

  const allowedExceptions06 = new Set([
    // L18: Tiêu chí frame_consistency chỉ áp dụng khi khóa dùng frame.md (bỏ bắt buộc cho mọi khóa có code)
    "| `frame_consistency` | Khóa có code: tên file/module, kiểu, biến thể, chữ ký, chuỗi in ra và import khớp `frame.md` và các bài kề; code và output trong bài ghép được với bài trước (đặt file ghép thử nếu cần). Lệch làm người học viết hoặc đọc code không biên dịch hay ra output khác bài kề: `flow_violation`, `blocking`; chỉ lệch chữ: `minor` |",
    // L31: Đổi đường dẫn sang roles/05-lesson/ và quy tắc phân loại minor của Gói 1
    "**Phân loại.** Mọi vi phạm một quy tắc viết bằng chữ trong `principles.md`, `platform.md`, `roles/05-lesson.md` hoặc `frame.md` là `blocking`, bất kể category (chọn category đúng nhất, kể cả `style_or_wording`, `insufficient_description`, `other`). `minor` chỉ dành cho gợi ý không vi phạm quy tắc nào và không làm người học hiểu sai, làm sai hay đọc sai (ví dụ chọn từ hay hơn). Nghi ngờ giữa hai mức thì chọn `blocking`.",
    // L51: Gói 1 sửa quy tắc unverified ở pass cho phát biểu phụ
    "- Phát biểu cốt lõi chưa đủ nguồn để xác minh: ghi `unverified` trong `checks`, tạo issue `wrong_source`, `blocking`, nêu phát biểu, bằng chứng còn thiếu và yêu cầu bổ sung research; không khẳng định phát biểu sai chỉ vì thiếu nguồn. Phát biểu phụ thiếu nguồn: ghi `unverified`, yêu cầu bỏ hoặc bổ sung nguồn, không tự nâng thành lỗi thực tế. Khi nguồn đã đọc chứng minh sai, dùng `factual_inaccuracy`, `blocking`.",
    // L67: Gói 1 sửa định nghĩa verdict pass không có unverified và không có issue 5 criteria cốt lõi
    "`verdict` là `pass` khi không có issue blocking hợp lệ.",
    // L3, L18: chuẩn đối chiếu và xưng hô trỏ thêm references/writing.md (quy ước riêng của skill tách khỏi principles.md)
    "Review MỘT lesson độc lập với tác giả. Không viết lại lesson. Chuẩn đối chiếu là `principles.md`, `platform.md`, lesson tương ứng trong `curriculum.json`, `research.json` và `verification/<lesson_id>.md`.",
    "| `language` | Tiếng Việt rõ, thuật ngữ nhất quán, xưng hô đúng mục Giọng văn (bạn / chúng ta / hãy; không \"mình\", \"tôi\", \"chúng tôi\"). Nhắc bài khác đúng nhãn app (\"Part A, Bài 2\") và khớp bảng nhãn; không có mã nội bộ (`lesson_id`, `module_id`, `source_ids`) trong chữ người học (vi phạm: `minor`, `style_or_wording`) |",
    // L19, L37: Quiz bỏ tiêu chí độ dài phương án; review chấm câu hỏi có cơ sở, nhiễu có lý do loại trừ (roles/06-lesson-review/quiz.md)
    "| `answers` | Quiz một đáp án đúng, không mơ hồ, giải thích từng phương án nhiễu; các phương án cùng độ dài, đáp án đúng không dài nhất, vị trí đáp án đúng trải đều; mỗi outcome của quiz được kiểm đủ các vế (thiếu một vế: `outcome_mismatch`, `blocking`). Code: một tổ hợp `accepted_answers` không biên dịch được là `wrong_answer`, `blocking`; instructions `fill` hứa app chạy test là `verification_mismatch`, `blocking`. `accepted_answers` và test không từ chối cách viết đã dạy; gợi ý không lộ đáp án. `fill` có 1–5 chỗ điền chỉ ở phần cốt lõi; `edit` chỉ khi test so khớp chuỗi chấm đáng tin (logic nhiều tầng hoặc nhiều lời giải đúng mà test chuỗi không phân biệt được: `unsupported_platform_format`, `blocking`) |",
    "- Quiz: đáp án đúng dài nhất hoặc ngắn bất thường so với nhiễu, đáp án đúng dồn một vị trí, explanation tự mâu thuẫn, thiếu câu curriculum yêu cầu cho outcome, khẳng định tuyệt đối vượt nguồn hoặc phản ví dụ hiển nhiên.",
  ]);

  const missing05 = [];
  for (let i = 0; i < orig05.length; i++) {
    const line = orig05[i].trim();
    if (line.length <= 25) continue;
    if (allowedExceptions05.has(line)) continue;
    if (!newContents.includes(line)) {
      missing05.push({ line: i + 1, text: line });
    }
  }

  const missing06 = [];
  for (let i = 0; i < orig06.length; i++) {
    const line = orig06[i].trim();
    if (line.length <= 25) continue;
    if (allowedExceptions06.has(line)) continue;
    if (!newContents.includes(line)) {
      missing06.push({ line: i + 1, text: line });
    }
  }

  assert.equal(missing05.length, 0, `Các dòng thiếu trong 05: ${JSON.stringify(missing05, null, 2)}`);
  assert.equal(missing06.length, 0, `Các dòng thiếu trong 06: ${JSON.stringify(missing06, null, 2)}`);
});
