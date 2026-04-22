# Khoá học online (Firestore) – Cấu trúc & cách tạo dữ liệu mẫu

## Cấu trúc Firestore (kiểu Udemy, video YouTube)

- **`courses`** (collection)
  - `title`, `slug`, `description`, `short_description`, `thumbnail_url`
  - `instructor_id`, `instructor_name`
  - `level`: `beginner` | `intermediate` | `advanced` | `all`
  - `total_duration_seconds`, `published` (boolean), `created_at`, `updated_at`

- **`courses/{courseId}/sections`** (subcollection)
  - `title`, `order` (number)

- **`courses/{courseId}/lessons`** (subcollection)
  - `section_id`, `title`, `youtube_url`, `duration_seconds`, `order`

- **`enrollments`** (collection)
  - `user_id`, `course_id`, `enrolled_at`, `last_accessed_at`

- **`lesson_progress`** (collection)
  - `user_id`, `lesson_id`, `course_id`, `completed_at` (timestamp hoặc null), `watch_seconds` (tùy chọn)

## Chỉ mục (indexes)

Đã khai báo trong `firestore.indexes.json`. Deploy bằng Firebase CLI:

```bash
firebase deploy --only firestore:indexes
```

Nếu chưa có index, lần đầu chạy app Firestore sẽ báo link tạo index – click vào link để tạo.

## Tạo khoá học mẫu

1. **Firebase Console** → Firestore → Thêm collection `courses` → Thêm document (ID tự động hoặc tự đặt), ví dụ:

```json
{
  "title": "React & TypeScript từ cơ bản đến nâng cao",
  "slug": "react-typescript-co-ban",
  "description": "Mô tả khoá học...",
  "thumbnail_url": "https://placehold.co/640x360/1e3a5f/fff?text=React",
  "instructor_id": "<uid của giảng viên hoặc admin>",
  "instructor_name": "Nguyễn Văn A",
  "level": "beginner",
  "total_duration_seconds": 28800,
  "published": true,
  "created_at": "2025-03-15T00:00:00.000Z",
  "updated_at": "2025-03-15T00:00:00.000Z"
}
```

2. Trong document khoá vừa tạo → Thêm **subcollection** `sections` → Thêm document:

```json
{ "title": "Chương 1: Giới thiệu", "order": 0 }
```

3. Thêm **subcollection** `lessons` → Thêm document (mỗi bài = 1 video YouTube):

```json
{
  "section_id": "<id của section vừa tạo>",
  "title": "Bài 1: Cài đặt môi trường",
  "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "duration_seconds": 600,
  "order": 0
}
```

4. Lặp lại thêm section và lesson cho các chương/bài khác. Đảm bảo `section_id` trong lesson trùng với id của section tương ứng.

## Routes đã thêm

- **`/courses`** – Danh sách khoá học (chỉ khoá đã publish).
- **`/courses/:id`** – Chi tiết khoá: mô tả, curriculum, nút ghi danh / tiếp tục học.
- **`/learn/:courseId`** – Redirect tới bài đầu tiên hoặc bài tiếp theo chưa học.
- **`/learn/:courseId/lesson/:lessonId`** – Trang học: embed YouTube, sidebar nội dung, đánh dấu đã xem.

Header: mục "Khoá học" trỏ tới `/courses`.
