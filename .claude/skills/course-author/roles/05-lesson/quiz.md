# Quy tắc viết bài: Quiz

Áp dụng kèm `roles/05-lesson/common.md`.

## Quiz

- Ít nhất 5 câu; `recall` 2–3 câu. Mỗi câu một đáp án đúng, 3–4 phương án với id `a`–`d`.
- Câu hỏi bắt dự đoán hoặc giải thích, không chỉ nhớ thuật ngữ. Mỗi câu tự đủ ngữ cảnh: mọi đoạn code, giá trị, tên được nhắc tới đều có trong câu hỏi. Đa số câu hỏi là dự đoán, giải thích, chẩn đoán dựa trên mô hình tư duy.
- Câu hỏi có thật: mỗi câu xuất phát từ tình huống người học gặp khi làm việc với chủ đề, có cơ sở trong nguồn research hoặc bài trước. Không hỏi chi tiết vụn hay dựng tình huống chỉ để có câu hỏi.
- Mỗi phương án sai có cơ sở: là một cách hiểu sai có thật (gắn misconception cụ thể từ `brief.misconceptions` hoặc research `misconceptions`), hoặc là lựa chọn đúng trong một tình huống khác mà người học dễ nhầm sang. Không dùng phương án vô nghĩa, đùa, hoặc sai hiển nhiên đến mức không ai chọn; không bịa phương án chỉ để đủ số lượng (thiếu nhiễu có cơ sở thì dùng 3 phương án).
- Độ khó vừa phải: người đã học loại được từng phương án sai bằng một lý do cụ thể từ mô hình tư duy; người chưa học không loại được nhờ dấu hiệu bề mặt (cách diễn đạt, chữ tuyệt đối như "luôn"/"không bao giờ", vị trí). Vị trí đáp án đúng trải đều trong cả bài.
- Mỗi `outcome_id` của quiz phải được kiểm đủ các vế của outcome (ví dụ outcome "chọn panic hay Result" cần cả tình huống đúng là panic lẫn tình huống đúng là Result), không chỉ một vế.
- `explanation` nói vì sao đáp án đúng, vì sao từng phương án nhiễu sai, và trỏ tới bài trong `review_lesson_ids` để ôn, viết bằng nhãn của app ("Part A, Bài 2"), không viết `lesson_id`. Nêu rõ mô hình tư duy và misconception liên quan.
- `final_check`: mỗi câu là tình huống mới; người chưa học không đoán đúng được, người đã học ở mức trung bình làm được. Đòi hỏi vận dụng mô hình tư duy trong tình huống mới.

## Output

Khối `quiz` trong `lessons/<lesson_id>.json`:

```json
"quiz": { "questions": [{ "id": "q1", "prompt": "", "options": [{ "id": "a", "text": "" }], "correct_index": 0, "explanation": "" }] }
```
