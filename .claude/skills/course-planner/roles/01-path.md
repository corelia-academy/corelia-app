# Role: Dựng hoặc Cập nhật Lộ trình Học (Path)

Vai trò này dùng công cụ tìm kiếm web (web research) để điều tra thực tế, đọc các trang web thật và lập hoặc cập nhật một bản lộ trình học (`path`) chuẩn hóa.

Path dựng quanh khóa đã chốt từ shortlist bắt buộc ghi `origin` trỏ tới file shortlist tương ứng. Path có `origin` hợp lệ được coordinator tự động chuyển sang `status: "approved"` và không bắt buộc trường `priority`. (Đối với path độc lập không có `origin`, path lưu ở trạng thái `status: "draft"` và cần Human duyệt).

---

## Nguyên tắc Nghiên cứu và Thu thập Bằng chứng

1. **Đọc trang thật:** Dùng web search, truy cập tài liệu chính thức, thông báo tuyển dụng thật hoặc mã nguồn thật. Bắt buộc ghi lại URL đầy đủ và ngày quan sát (`observed_on`).
2. **Phân loại bằng chứng khắt khe (`kind`):**
   - `direct`: Yêu cầu năng lực được mô tả trực tiếp trong bản mô tả công việc (JD), tài liệu chuẩn/đặc tả kỹ thuật (RFC/spec) hoặc yêu cầu bắt buộc của hệ sinh thái.
   - `inferred`: Các chỉ số gián tiếp như lượt tải package, số sao GitHub (stars), số câu hỏi trên StackOverflow / diễn đàn cộng đồng, hoặc suy luận từ xu hướng chung. TUYỆT ĐỐI không ghi nhận các chỉ số này là `direct`.
3. **Chỉ ra phần còn thiếu (`missing_evidence`):** Thành thật liệt kê những giả định chưa có bằng chứng xác thực để người dùng nắm rõ.
4. **Không lưu trạng thái sản xuất trong path:** Path chỉ định hình khung kiến thức, không lưu cờ tiến độ sản xuất (tiến độ do `catalog-snapshot.mjs` suy ra).

---

## Tiên quyết và Thứ tự

- **Đối chiếu Catalog:** Bắt buộc đọc file `.course-plan/catalog.json` trước khi lập path; với bất kỳ khóa học nào đã tồn tại trong catalog, BẮT BUỘC dùng đúng `slug` có sẵn. Khóa dùng chung giữa nhiều path phải sử dụng cùng một `slug`.
- **Ô khởi đầu cho Beginner:** Path có `entry_level: "beginner"` BẮT BUỘC phải có ít nhất một ô khóa khởi đầu ở cùng trình độ `level: "beginner"` và không có tiên quyết (`requires: []`) để người mới có thể bắt đầu ngay.
- **Ranh giới từng ô khóa:** Mỗi ô khóa trong `courses` bắt buộc có:
  - `task`: một hành động cụ thể người học làm được và quan sát được khi học xong.
  - `scope`: mảng chuỗi các chủ đề cốt lõi của ô khóa này.
  - `out_of_scope`: mảng chuỗi nêu rõ ranh giới phân định với ô kề (điều để lại cho khóa sau hoặc giả định từ khóa trước).
- `requires`: Chỉ ghi nhận quan hệ tiên quyết THỰC SỰ (khóa A bắt buộc phải học trước khóa B vì lý do kiến thức hoặc năng lực nền). Mọi phần tử trong `requires` bắt buộc phải có `reason` giải thích rõ ràng và cụ thể.
- `suggested_order`: Thứ tự gợi ý học mang tính sư phạm. `suggested_order` **KHÔNG TỰ TẠO RA TIÊN QUYẾT**. Không được nhầm lẫn giữa thứ tự trình bày và phụ thuộc logic.
- **Báo cáo cấu trúc Path:** Báo cáo path phải nêu từng ô khóa, lý do thứ tự và các phần dữ liệu thiếu bằng chứng (`missing_evidence`).

---

## Cấu trúc File Đầu Ra

Path được dựng nháp (`status: "draft"`) quanh khóa đã chốt từ shortlist: chuỗi tiên quyết và tối đa 2 khóa kế tiếp. Bắt buộc ghi `origin` trỏ tới file shortlist tương ứng và `pitch_slug` là slug của khóa đã được Human chốt.

File được ghi tại `.course-plan/paths/<path-slug>.json`:

```json
{
  "slug": "blockchain-security-auditor",
  "title": "Lộ trình Kiểm toán An ninh Hợp đồng Thông minh",
  "origin": {
    "shortlist": ".course-plan/shortlists/YYYY-MM-DD-1.json",
    "pitch_slug": "smart-contract-reading-before-interacting"
  },
  "axis": "role",
  "goal": "Đào tạo kỹ sư an ninh có khả năng phân tích, rà soát mã nguồn và phát hiện các lỗ hổng bảo mật phổ biến trên Web3.",
  "audience": "Lập trình viên đã biết lập trình cơ bản muốn chuyên sâu mảng audit hợp đồng thông minh.",
  "entry_level": "intermediate",
  "scope": [
    "Đọc hiểu bytecode và source contract trên EVM",
    "Phân tích các lỗ hổng reentrancy, access control, integer overflow",
    "Kỹ thuật kiểm thử tĩnh và rà soát thủ công"
  ],
  "out_of_scope": [
    "Viết formal verification nâng cao với Certora / Coq",
    "Tấn công hạ tầng RPC và mempool"
  ],
  "status": "approved",
  "priority": 1,
  "evidence": [
    {
      "claim": "Báo cáo an ninh Web3 2026 yêu cầu kỹ năng đọc hiểu flow tương tác contract trước khi gọi lệnh",
      "kind": "direct",
      "urls": ["https://example.com/reports/web3-security-2026"],
      "observed_on": "2026-11-13"
    },
    {
      "claim": "Tăng trưởng số lượng sự cố liên quan đến ủy quyền approve",
      "kind": "inferred",
      "urls": ["https://example.com/stats/defi-hacks"],
      "observed_on": "2026-11-13"
    }
  ],
  "missing_evidence": [
    "Dữ liệu khảo sát mức lương kiểm toán viên Web3 tại thị trường Việt Nam"
  ],
  "courses": [
    {
      "slug": "smart-contract-reading-before-interacting",
      "title": "Đọc hiểu Smart Contract trước khi tương tác",
      "task": "Đọc và phân tích luồng thực thi của hàm nạp/rút tiền trên Etherscan để nhận diện rủi ro",
      "level": "intermediate",
      "scope": [
        "Đọc bytecode và opcode cơ bản",
        "Trace luồng gọi hàm trên Etherscan"
      ],
      "out_of_scope": [
        "Phân tích lỗ hổng sâu (để khóa sau)",
        "Viết code khai thác"
      ],
      "suggested_order": 1,
      "is_foundation": true,
      "requires": []
    },
    {
      "slug": "smart-contract-reentrancy-defense",
      "title": "Phòng chống tấn công Reentrancy",
      "task": "Tái hiện tấn công reentrancy trên local testnet và cài đặt checks-effects-interactions pattern",
      "level": "intermediate",
      "scope": [
        "Cơ chế callback reentrancy",
        "Checks-effects-interactions pattern"
      ],
      "out_of_scope": [
        "Đọc hiểu hợp đồng tổng quan (đã học ở khóa trước)",
        "Flash loan attack"
      ],
      "suggested_order": 2,
      "is_foundation": false,
      "requires": [
        {
          "slug": "smart-contract-reading-before-interacting",
          "reason": "Phải biết đọc và trace luồng gọi hàm trước khi có thể hiểu được callback reentrancy"
        }
      ]
    }
  ]
}
```

Lưu ý:
- `axis`: bắt buộc là một trong 3 giá trị: `"role"` | `"skill"` | `"ecosystem"`.
- `entry_level`: bắt buộc là `"beginner"` | `"intermediate"` | `"advanced"`.
- `priority`: số nguyên >= 1 đối với path không có `origin`; tùy chọn khi path có `origin` hợp lệ.
