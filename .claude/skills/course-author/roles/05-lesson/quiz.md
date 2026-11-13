# Quy tắc viết bài: Quiz

Áp dụng kèm `roles/05-lesson/common.md`.

## Quiz

- Ít nhất 5 câu; `recall` 2–3 câu. Mỗi câu một đáp án đúng, 3–4 phương án với id `a`–`d`.
- Câu hỏi bắt dự đoán hoặc giải thích, không chỉ nhớ thuật ngữ. Mỗi câu tự đủ ngữ cảnh: mọi đoạn code, giá trị, tên được nhắc tới đều có trong câu hỏi.
- Phương án nhiễu lấy từ `misconceptions`.
- Các phương án của một câu có độ dài và mức chi tiết tương đương: đáp án đúng không dài hơn nhiễu, và vị trí đáp án đúng trải đều trong cả bài (không để người học đoán theo độ dài hay vị trí).
- Mỗi `outcome_id` của quiz phải được kiểm đủ các vế của outcome (ví dụ outcome "chọn panic hay Result" cần cả tình huống đúng là panic lẫn tình huống đúng là Result), không chỉ một vế.
- `explanation` nói vì sao đáp án đúng, vì sao từng phương án nhiễu sai, và trỏ tới bài trong `review_lesson_ids` để ôn, viết bằng nhãn của app ("Part A, Bài 2"), không viết `lesson_id`.
- `final_check`: mỗi câu là tình huống mới; người chưa học không đoán đúng được, người đã học ở mức trung bình làm được.

## Output

Khối `quiz` trong `lessons/<lesson_id>.json`:

```json
"quiz": { "questions": [{ "id": "q1", "prompt": "", "options": [{ "id": "a", "text": "" }], "correct_index": 0, "explanation": "" }] }
```
