---
name: course-author
description: Tạo một khóa học Corelia hoàn chỉnh (metadata, brief, research, curriculum, lesson, bài cuối khóa) bằng tiếng Việt, theo chuẩn learning-principles, ra file cục bộ sẵn để import lên Supabase staging. Dùng khi user yêu cầu tạo, soạn hoặc sinh khóa học mới cho Corelia.
---

# Course author

Bạn là coordinator. Bạn điều phối, kiểm output và quyết định bước tiếp theo; nội dung của từng bước do child (subagent) viết theo đúng file role.

Trước khi bắt đầu, đọc `references/principles.md` và `references/platform.md`. Hai file này là chuẩn chung; mọi role đều phải tuân theo.

## Đầu vào từ user

- Tên khóa và chủ đề
- Đối tượng, trình độ
- Phạm vi do người quản lý nêu (`scope_note`), nếu có
- Path/track trong catalog, nếu có

Thiếu tên khóa hoặc đối tượng thì hỏi user, không tự đoán.

## Thư mục làm việc

Mỗi khóa một thư mục `.course-runs/<slug>/` ở gốc repo. Không commit thư mục này.

```
metadata.json      bước 1
brief.json         bước 1
research.json      bước 2
curriculum.json    bước 3
reviews/curriculum.json
lessons/<lesson_id>.json
reviews/<lesson_id>.json
verification/<lesson_id>.md
final_assignment.json
```

Mỗi file chỉ do một child ghi. Child đọc file của bước trước, không sửa file của bước khác.

## Các bước

| Bước | Role | Đầu vào | Đầu ra |
|---|---|---|---|
| 1 | `roles/01-brief.md` | đầu vào user, catalog hiện có | `metadata.json`, `brief.json` |
| 2 | `roles/02-research.md` | `brief.json` | `research.json` |
| 3 | `roles/03-curriculum.md` | `brief.json`, `research.json` | `curriculum.json`, `final_assignment.json` |
| 4 | `roles/04-curriculum-review.md` | các file bước 1–3 | `reviews/curriculum.json` |
| 5 | `roles/05-lesson.md` | curriculum, research, lesson trước/sau | `lessons/<id>.json`, `verification/<id>.md` |
| 6 | `roles/06-lesson-review.md` | lesson, research, curriculum | `reviews/<id>.json` |

Bước 5 và 6 chạy theo từng lesson. Các lesson không phụ thuộc nhau có thể chạy song song, mỗi lesson một child. Lesson dùng lại khung code của bài trước thì chờ bài trước xong.

## Gọi child

Mỗi child nhận:

1. Nội dung file role của bước đó.
2. Đường dẫn tới `references/principles.md` và `references/platform.md`.
3. Đường dẫn tuyệt đối tới các file đầu vào và file đầu ra nó được ghi.
4. Với bước 5 và 6: `lesson_id`, module chứa lesson, lesson trước và sau trong curriculum, cùng bảng nhãn app cho mọi lesson và module (`lesson_id` → "Part X, Bài N"; N là số thứ tự trong Part chứa bài, bắt đầu lại từ 1 ở mỗi Part, đếm cả quiz, practice và video). Child dùng bảng này khi nhắc bài khác, và không đưa mã nội bộ vào chữ người học.

Child không gọi child khác, không sửa file ngoài file đầu ra của mình, không ghi lên DB.

## Model

Coordinator chạy bằng model của session: Sonnet 5.5, effort medium. Session đang dùng model khác thì báo user trước khi bắt đầu.

Khi gọi child, đặt `model` theo bảng:

| Child | Model |
|---|---|
| Bước 1: metadata, brief | `haiku` |
| Bước 2: research | `sonnet` |
| Bước 3: curriculum | `sonnet` |
| Bước 4: review curriculum | `sonnet` |
| Bước 5: viết lesson | `sonnet` |
| Bước 5: chạy kiểm chứng (`verification/<id>.md`) | `haiku` |
| Bước 6: review lesson | `sonnet` |

Ở bước 5, child viết lesson soạn danh sách bước cần chạy. Một child `haiku` riêng chạy các bước đó và ghi `verification/<id>.md`. Child viết lesson đọc kết quả rồi sửa bài nếu output thật khác `expected`.

Child viết lesson chỉ nhận phần research thuộc `source_ids` của lesson và các `misconceptions`, `setup_steps`, `videos` của topic liên quan, không nhận toàn bộ `research.json`.

## Kiểm output và chạy lại

Sau mỗi child, kiểm output theo phần **Output** trong file role: đủ trường bắt buộc, đúng kiểu, ID tham chiếu tồn tại, không vi phạm `platform.md`. Kết quả kiểm là: đạt, hoặc không đạt kèm lý do cụ thể (trường nào, sai gì).

Lesson có sơ đồ: coordinator chạy thêm `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json`; còn dòng báo lỗi thì kết quả là không đạt, kèm đúng các dòng đó.

- **Đạt:** sang bước sau.
- **Không đạt, hoặc review trả `needs_fix`:** gọi lại child của bước đó, đưa kèm lý do không đạt (hoặc các issue blocking của review) và output cũ. Child sửa đúng các điểm được nêu, giữ nguyên phần đã đạt.
- **Dừng và báo user** khi lần chạy lại bị từ chối với đúng lý do của lần trước. Khi đó lỗi nằm ở hợp đồng (file role, platform hoặc đầu vào) chứ không nằm ở output; báo lý do, bước và file liên quan để user sửa hợp đồng.

Research thiếu nguồn cho một chủ đề cốt lõi (curriculum hoặc review chỉ ra) thì quay lại bước 2 với danh sách mục cần bổ sung; áp dụng cùng quy tắc dừng.
Khi lesson hoặc lesson review chỉ ra kiến thức nền hay hướng dẫn cốt lõi chưa đủ bằng chứng, quay lại bước 2 bổ sung nguồn và phạm vi áp dụng; sau đó chuyển research cập nhật cho người viết lesson và review lại. Không coi `unverified` ở phần cốt lõi là `pass`; giữ nguyên các issue blocking khác khi chạy lại.

## Kiểm chứng bước thực hành

Mỗi lesson có ví dụ chạy được hoặc practice phải có `verification/<id>.md`. Mặc định AI tự chạy:

- Bước dùng lệnh (cài đặt, chạy, build, test): chạy bằng shell trong một thư mục tạm riêng của lesson, ghi lệnh và output thật.
- Bước cần giao diện (trình duyệt, IDE, ví): dùng computer use, ghi lại thao tác và kết quả quan sát được.
- Không dùng ví, private key, tài khoản hay tiền thật. Bước cần những thứ đó ghi `not_run` kèm lý do.

Nếu user chọn tự chạy, child chỉ chuẩn bị danh sách bước cần chạy; user điền kết quả vào cùng file.

Kết quả thật khác với kết quả mong đợi trong bài thì lesson không đạt, child sửa bài theo kết quả thật.

## Hoàn thành

Khóa xong khi mọi file ở trên đạt và mọi review là `pass`. Báo user:

- Danh sách module, lesson và loại bài
- Các bước thực hành `not_run` và lý do
- Các `open_questions` còn lại trong research

Không tự import. Import lên staging do user chạy bằng script hiện có.
