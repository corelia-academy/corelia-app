# Learning authorization surfaces — evidence map

Bảng này dẫn tới kiểm thử đã thực thi; trạng thái nghiệm thu chỉ nằm trong acceptance-status.md.

| Surface | Đối tượng / actor | Quy tắc và bằng chứng |
|---|---|---|
| REST reads | Anonymous, learner, owner, co-content, co-review, attribution-only, support, admin | learning-policy-postgrest.integration.mjs:8actors×5states (lesson draft/archive/published, course draft/archive), lessons/locales/questions/resources và course/section locale. Chỉ owner/content/support/admin đọc nội dung ẩn; attribution-only không được quyền. Log /tmp/corelia-learning-publication-rest.log. |
| REST writes | Cùng8actors | Cùng harness: course create/metadata/locale và mutation minimal/representation; SQL policy-scope kiểm tra UPDATE/DELETE từng bảng theo role thật. Zero-row không được client báo thành công. |
| RPC | lesson authoring, question Save, quiz, final submit/review, reports/roster, course Save | learning-system.integration.sql, learning-audit.integration.sql, learning-course-save.integration.sql và learning-concurrency.mjs trong gate fresh223migrations. Scope course/user, unavailable content, trực tiếp completion quiz denied, transaction rollback, reviewer/content độc lập. |
| Edge | courses.syncCompletion | learning-edge.integration.mjs:8actors; anonymous401, người không có quyền403, actor hợp lệ vào domain gate no_enrollment400/completed=false. Không phát credential/email. Chạy lại pass /tmp/corelia-learning-edge-closure.log. |
| Edge publication reads | Không áp dụng cho nội dung lesson | corelia-api/index.ts không cung cấp endpoint trả lesson/question/locale/resource. Public content đọc REST/RLS; không giả lập endpoint Edge không tồn tại để điền matrix. Mail/invite/reminder anonymous bị từ chối; quyền tương ứng kiểm tra authz tests. |
| Storage | Final assignment file | learning-storage.integration.mjs:8actors download/update/upsert/remove; owner/learner-owner/reviewer/support/admin đọc; content/attribution/anonymous bị chặn. Không actor nào ghi đè/xóa file lịch sử; draft course upload denied. Chạy lại pass /tmp/corelia-learning-storage-closure.log. |
| Resources | Metadata trong lesson/locale JSONB | Visibility theo REST row đã kiểm tra. URL tham khảo public bên ngoài không phải private Storage object; Learning chỉ ẩn metadata draft, không tuyên bố thu hồi URL public của bên thứ ba. |

Staff giữ quyền hiện hữu gồm support/admin. Instructor attribution không thay ownership, co-instructor features hay invite. Các probe dùng fixture riêng và cleanup/rollback; không đọc artifact thật của learner.
