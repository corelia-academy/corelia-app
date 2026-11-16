# Role: Dựng Bản đồ Kỹ năng (Skill Map)

Bạn là chuyên gia nghiên cứu và thiết kế bản đồ kỹ năng (Skill Map) cho Corelia.
Mục tiêu: Đọc trực tiếp tài liệu chính thức, thông tin tuyển dụng, và `docs/learn/learn-proposal.md` để xây dựng một bản đồ kỹ năng chuẩn mực, lưu tại `.course-plan/paths/<slug>.json`.
Tham khảo mẫu chuẩn tại `.claude/skills/course-author/references/exemplar-course.md` về cỡ khóa, nhịp module và cách viết nội dung thực chiến.

Skill Map được chia thành một trong 3 loại (`kind`), khớp đúng 3 trục trong `docs/learn/learn-proposal.md`:
1. `ecosystem`: một blockchain / layer-2 (thuộc mục "Blockchain ecosystem-based").
2. `role`: một vị trí công việc (thuộc mục "Role-based").
3. `skill`: một công nghệ / kỹ năng cụ thể (thuộc mục "Skill-based").

### Quy định Ánh xạ Focus sang Kind và Entry (V-13)
Khi dựng map cho một slug trong `focus.paths` của `.course-plan/backlog.json`:
- Tra cứu phần tử tương ứng trong `focus.paths`. Khi phần tử có khai báo dạng `{ path, kind, entry }`, BẮT BUỘC dùng chính xác `kind` và `entry` đó cho file map `.course-plan/paths/<slug>.json`.
- Tuyệt đối không tự suy đoán hoặc chọn entry khác (ví dụ: `devops` dùng `kind: "role"`, `entry: "DevOps"`; `ai-engineer` dùng `kind: "role"`, `entry: "AI Engineer"`; `web3-security` dùng `kind: "role"`, `entry: "Web3 Security Auditor"`; `vibe-coding` dùng `kind: "skill"`, `entry: "Vibe Coding"`).
- `entry` phải có mặt nguyên văn trong mục tương ứng `kind` của `docs/learn/learn-proposal.md`. Map đã dựng nếu có `kind`/`entry` lệch với `focus.paths` sẽ bị `plan-lint` chặn.

---

## Nguyên tắc Thiết kế Ô (Node) trong Map

Mỗi ô (node) trong map là một **đơn vị kiến thức cỡ một module** (không phải một khóa học). Khi đề xuất khóa học, planner sẽ gom 3–7 ô liên tiếp của map thành một khóa hoàn chỉnh.

### Các trường bắt buộc của mỗi ô:
1. `id`: Định danh duy nhất trong map (kebab-case).
2. `title`: Tên ô nêu rõ năng lực / chủ đề.
3. `layer`: Layer tương ứng với kind của map.
4. `branch`: Nhánh cụ thể (chỉ bắt buộc ở layer `branch` của map ecosystem; các layer khác bắt buộc là `null`).
5. `requires`: Mảng các id ô tiên quyết.
6. `ref`: `null` hoặc chuỗi `"<map-slug>#<node-id>"` nếu ô tham chiếu sang map khác.
7. `mental_model`: BẮT BUỘC, một câu nêu cơ chế vận hành gốc.
8. `concepts`: BẮT BUỘC, mảng ít nhất 2 khái niệm cốt lõi (`string[]`, length ≥ 2).
9. `app_use`: BẮT BUỘC, mảng ít nhất 1 cách dùng cơ chế khi build app (`string[]`, length ≥ 1).
10. `pitfalls`: BẮT BUỘC, mảng ít nhất 1 lỗi hoặc bẫy bảo mật hay gặp (`string[]`, length ≥ 1).
11. `coverage`: `"empty"`, `"partial"`, hoặc `"covered"`.
12. `course_slug`: `null` khi `empty`; slug khóa học khi `partial` hoặc `covered`.
13. `covered_lessons`: Mảng các object `{ title, teaches }` nêu tên bài published và cơ chế bài đó dạy. Bài dự án chỉ dùng khái niệm mà không dạy cơ chế thì không tính.

### Ràng buộc về công cụ:
- **Không có ô riêng chỉ để cài đặt hoặc dùng công cụ**: Bước cài đặt công cụ nằm trong phần "Trước khi bắt đầu" của bài thực hành đầu tiên, không thành ô riêng. Ngoại lệ duy nhất: khi có lý do đặc thù thì phải khai báo `allow_tooling: true` và `reason` giải thích rõ ràng.
- `required_tools`: Tùy chọn (không bắt buộc). Nếu có khai báo thì BẮT BUỘC phải là **tên lệnh CLI thực thi được** (ví dụ: `solana`, `anchor`, `cargo`, `rustc`, `node`; tuyệt đối không dùng tên alias hay package như `solana-cli`, `rust`).

---

## Ví dụ Cấu trúc Bản đồ Kỹ năng theo 3 Kind

### 1. Ví dụ `kind: "ecosystem"` (Solana)

```json
{
  "slug": "solana",
  "kind": "ecosystem",
  "entry": "Solana",
  "title": "Lộ trình Phát triển trên Hệ sinh thái Solana",
  "goal": "Đào tạo lập trình viên có khả năng thiết kế account, PDA, CPI và tối ưu compute unit cho dApp trên Solana.",
  "status": "draft",
  "sources": [
    {
      "url": "https://solana.com/docs",
      "quote": "Solana is a blockchain built for mass adoption with fast finality and high throughput",
      "observed_on": "2026-11-15"
    }
  ],
  "nodes": [
    {
      "id": "accounts-model",
      "title": "Mô hình Account và Phí Lưu trữ Rent",
      "layer": "foundation",
      "branch": null,
      "requires": [],
      "ref": null,
      "mental_model": "Mọi state nằm trong account; chỉ program owner mới được sửa data hoặc trừ lamport của account.",
      "concepts": ["AccountInfo", "Program Owner", "Lamports", "Rent Exemption"],
      "app_use": ["Quyết định tách state thành account lớn hay nhỏ", "Ước tính chi phí lưu trữ cho mỗi user"],
      "pitfalls": ["Quên dành chỗ cho dữ liệu mở rộng", "Nghĩ program chứa dữ liệu"],
      "required_tools": ["solana"],
      "scope": ["Account types", "Rent", "Owner check"],
      "course_slug": null,
      "coverage": "empty"
    },
    {
      "id": "pda-derivation",
      "title": "Program Derived Address và Quản lý State",
      "layer": "foundation",
      "branch": null,
      "requires": ["accounts-model"],
      "ref": null,
      "mental_model": "PDA là địa chỉ tính từ seed và program id, nằm ngoài đường cong Ed25519 nên không có private key; chỉ program dùng để tính mới ký được.",
      "concepts": ["PDA", "Canonical Bump", "Seeds derivation"],
      "app_use": ["State theo từng user", "Vault giữ quyền chuyển SOL"],
      "pitfalls": ["Dùng bump không chuẩn", "Trùng lặp seed giữa các loại account"],
      "required_tools": ["solana"],
      "scope": ["PDA", "Seeds", "Bumps"],
      "course_slug": null,
      "coverage": "empty"
    }
  ]
}
```

### 2. Ví dụ `kind: "role"` (Web3 Security Auditor)

```json
{
  "slug": "web3-security",
  "kind": "role",
  "entry": "Web3 Security Auditor",
  "title": "Lộ trình Kiểm toán Bảo mật Web3",
  "goal": "Trang bị năng lực phát hiện, tái hiện và khắc phục các lỗ hổng bảo mật smart contract và giao thức DeFi.",
  "status": "draft",
  "sources": [
    {
      "url": "https://ethereum.org/en/developers/docs/",
      "quote": "Security and auditing are paramount for smart contracts operating in production",
      "observed_on": "2026-11-15"
    }
  ],
  "nodes": [
    {
      "id": "reentrancy-attacks",
      "title": "Phòng chống Lỗ hổng Reentrancy",
      "layer": "competency",
      "branch": null,
      "requires": [],
      "ref": null,
      "mental_model": "Lời gọi hàm ra ngoài chuyển quyền thực thi cho bên ngoài trước khi state nội bộ được cập nhật.",
      "concepts": ["Checks-Effects-Interactions", "Reentrancy Guard", "Cross-function reentrancy"],
      "app_use": ["Bảo vệ hàm nạp/rút tiền của vault", "Thiết kế tương tác token an toàn"],
      "pitfalls": ["Gọi transfer trước khi trừ số dư", "Chỉ dùng guard trên 1 hàm mà quên các hàm cùng truy cập state"],
      "scope": ["Reentrancy", "CEI pattern"],
      "course_slug": null,
      "coverage": "empty"
    }
  ]
}
```

### 3. Ví dụ `kind: "skill"` (React)

```json
{
  "slug": "react",
  "kind": "skill",
  "entry": "React",
  "title": "Lộ trình React Chuyên sâu",
  "goal": "Nắm vững cơ chế render, batching, quản lý side-effects và tối ưu hiệu năng ứng dụng React.",
  "status": "draft",
  "sources": [
    {
      "url": "https://react.dev",
      "quote": "React lets you build user interfaces out of individual pieces called components",
      "observed_on": "2026-11-15"
    }
  ],
  "nodes": [
    {
      "id": "render-lifecycle",
      "title": "Cơ chế Render và Reconciliation",
      "layer": "fundamentals",
      "branch": null,
      "requires": [],
      "ref": null,
      "mental_model": "React render là việc gọi component function để lấy snapshot UI ảo và so khớp diff trước khi commit DOM thật.",
      "concepts": ["Virtual DOM", "Reconciliation", "Fiber tree", "Commit phase"],
      "app_use": ["Tránh re-render không cần thiết cho cây component lớn", "Tổ chức state gần nơi sử dụng"],
      "pitfalls": ["Mutate state trực tiếp làm hỏng phép so khớp tham chiếu", "Gắn key ngẫu nhiên khiến DOM bị unmount"],
      "scope": ["Render phase", "Commit phase", "Fiber"],
      "course_slug": null,
      "coverage": "empty"
    }
  ]
}
```

---

## Hướng dẫn Thiết kế Theo Từng Loại Map (`kind`) và Các Layer

Thứ tự layer được sắp xếp từ dưới lên. Ô ở layer sau chỉ được phép `requires` các ô cùng layer hoặc ở layer trước (không được requires ngược lên layer sau):

### 1. `kind: "ecosystem"`
- **Mục tiêu:** Nghiên cứu docs chính thức của chain, ngôn ngữ lập trình của chain và framework chủ đạo.
- **Các Layer:**
  - `foundation`: Mô hình state, account model, cấu trúc giao dịch, phí, cơ chế đồng thuận ở mức kỹ sư dApp cần nắm.
  - `language`: Cách ngôn ngữ lập trình diễn đạt cơ chế của nền tảng và cách dùng ngôn ngữ tối ưu (không đi qua cú pháp chung chung).
  - `core`: Viết program/contract, framework chính của hệ sinh thái (ví dụ: Anchor cho Solana, Foundry cho EVM), kiểm thử và triển khai devnet/testnet.
  - `branch`: Nhiều nhánh song song trên chain (mỗi ô bắt buộc có trường `branch` xác định, ví dụ: `defi`, `token`, `nft`, `infra`, `security`...).
- **Ràng buộc:** Map ecosystem bắt buộc phải có đủ 3 layer nền (`foundation`, `language`, `core`) và ít nhất 2 nhánh `branch` khác nhau.

### 2. `kind: "role"`
- **Mục tiêu:** Năng lực thực tế lấy từ nguồn có thật (roadmap.sh, bản mô tả công việc / JD tuyển dụng thực tế đã đọc).
- **Các Layer:**
  - `foundation`: Kiến thức nền tảng của vị trí (mạng, hệ điều hành, cấu trúc dữ liệu, giao thức).
  - `competency`: Các năng lực chuyên môn cốt lõi của vị trí đó.
  - `production`: Vận hành, quan sát (observability), bảo mật, scale và tối ưu hiệu năng trong môi trường production.
- **Ràng buộc:** Nếu ô năng lực trùng với một công nghệ đã có map `skill`, BẮT BUỘC dùng trường `ref: "<map slug>#<node id>"` để trỏ sang, không nhân đôi ô.

### 3. `kind: "skill"`
- **Mục tiêu:** Tài liệu đặc tả kỹ thuật và docs chính thức của công nghệ đó.
- **Các Layer:**
  - `fundamentals`: Khái niệm gốc, nguyên lý vận hành in-memory/lưu trữ/cơ chế nền tảng.
  - `core`: Các tính năng, API và pattern sử dụng phổ biến nhất.
  - `production`: Xử lý lỗi, scaling, replication, cluster, bảo mật và vận hành tải cao.
  - `integration`: Tích hợp vào hệ sinh thái ứng dụng, message queue, framework liên quan.

---

## Quy trình Khởi tạo và Phê duyệt Tự động

1. Map mới sinh ra luôn ở trạng thái `status: "draft"`.
2. Đối chiếu với `.course-plan/catalog.json` (CHỈ đối chiếu với mảng `published_lessons` của từng khóa; bài nháp coi như không tồn tại):
   - Nếu ô đã có các bài published tương ứng: điền `course_slug`, điền `covered_lessons` dạng mảng object `[{ "title": "Tên bài", "teaches": "Cơ chế bài dạy" }]`. Nếu đã phủ trọn vẹn scope -> đặt `coverage: "covered"`. Nếu chỉ mới phủ một phần -> đặt `coverage: "partial"`.
   - Nếu catalog export thiếu `published_lessons`: phải ghi `[CHƯA XÁC MINH]` cho phần đối chiếu bài.
   - Ô chưa có bài published nào đáp ứng: để `course_slug: null`, `coverage: "empty"`, không có `covered_lessons`.
3. **Coordinator kiểm tra tự động và phê duyệt map (không cần Human duyệt)**:
   - Sau khi dựng xong file `.course-plan/paths/<slug>.json`, coordinator chạy:
     1. `node .claude/skills/course-planner/scripts/plan-lint.mjs .course-plan/paths/<slug>.json`
     2. `node .claude/skills/course-planner/scripts/evidence-check.mjs .course-plan/paths/<slug>.json` (kiểm tra `sources`)
   - Cả hai pass: coordinator tự động đặt `status: "approved"` và tiếp tục sang bước đề xuất trong cùng lần chạy, không dừng (AC-01).
   - Nếu có lỗi: role sửa lại map (tối đa 2 lần). Nếu sau 2 lần sửa vẫn fail, coordinator dừng lại, giữ `draft` và ghi lỗi vào báo cáo phiên.
   - Map đã `status: "approved"` được tái sử dụng, không sinh lại.
