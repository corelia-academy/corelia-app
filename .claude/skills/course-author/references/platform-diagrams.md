## Sơ đồ (trong article)

Đặc tả dữ liệu, không phải ảnh. Tối đa 4 cột (0–3), 3 hàng (0–2), 8 node, mỗi ô một node. Nhãn node tối đa 4 từ và 24 ký tự, không trùng nhau, giữ nguyên tên lệnh và biến. Cạnh đi từ nguồn tới đích đúng nghĩa. `route: straight` chỉ khi đường thẳng không xuyên node khác, còn lại dùng `arc_above` hoặc `arc_below`. Hai cạnh giữa cùng một cặp node dùng hai route khác nhau. `style: dashed` cùng `crossed: true` cho quan hệ không còn hợp lệ. Tham chiếu trong markdown bằng `![mô tả](diagram:<id>)`, mỗi sơ đồ đúng một lần.

### Nội dung sơ đồ

Một sơ đồ đọc như một loạt câu "A — nhãn → B". Trước khi chốt, đọc to từng cạnh; cạnh nào không thành câu thì viết lại.

1. **Một ý chính cho mỗi sơ đồ**, thường 4–6 node. Điều quan trọng nhất phải thấy được ngay trên hình (ví dụ một cạnh không đáng tin vẽ bằng nét đứt gạch chéo), không chỉ nằm trong đoạn văn.
2. **Các node cùng loại với nhau:** mỗi node là một thành phần, một màn hình, một giá trị hoặc một thông điệp trích nguyên văn (đặt trong ngoặc kép). Không trộn node là hành động, trạng thái hoặc lời mô tả về một node khác vào cùng sơ đồ, trừ khi sơ đồ là lưu đồ quyết định (câu hỏi và kết luận).
3. **Nhãn cạnh là động từ hoặc điều kiện ngắn**, cùng dạng ngữ pháp trong cả sơ đồ. Không để nhãn là danh từ trơ ("giao dịch", "địa chỉ"), không lặp một nhãn chung chung ("kết quả", "tiếp theo") cho nhiều cạnh. Dãy tuần tự đã đánh số thì để cạnh không nhãn.
4. **Dùng chính từ người học sẽ thấy** ở màn hình hoặc ở đề bài, viết giống hệt trong văn bản; văn bản dẫn người học đi theo đúng các nhãn đó.

### Bố cục sơ đồ

Sơ đồ gọn là sơ đồ mà người học đọc một lượt từ trái sang phải mà không phải tìm node tiếp theo ở góc khác. Đặt node theo các quy tắc sau:

1. **Dòng chảy chính nằm trong một hàng**, từ trái sang phải theo thứ tự đọc. Chuỗi tới 4 node nằm trọn trong một hàng (đủ 4 cột); không thả node cuối xuống hàng mới khi ô bên phải node trước nó còn trống.
2. **Nguồn phụ** (lời nói, điều kiện, đầu vào) đặt ở hàng trên, cùng cột với node chúng dẫn vào, để cạnh đi thẳng xuống và hợp lưu với dòng chính. Kết quả phụ hoặc ngoại lệ đặt ở hàng dưới theo cách tương tự.
3. **Rẽ nhánh:** hai kết quả đặt đối xứng ở hàng trên và hàng dưới của cột kế bên node rẽ nhánh. Hợp lưu sau nhánh (kim cương) cũng đặt đối xứng.
4. **Ưu tiên 2 hàng.** Hàng thứ ba chỉ dùng cho rẽ nhánh hoặc hợp lưu thật (cây quyết định, kim cương). Không để một node đứng một mình ở một hàng chỉ vì nó được thả thẳng xuống từ node dẫn tới nó.
5. **Không để góc trống lớn** trong khung vẽ: nếu một ô kề ngay node nguồn còn trống, đưa node đích vào ô đó thay vì xuống hàng khác.
6. Cạnh thẳng nối hai ô kề nhau trong cùng hàng hoặc cùng cột. Cạnh chéo chỉ dùng khi hợp lưu hoặc rẽ nhánh. Cạnh có thể đi qua ô trống, không đi qua ô có node.
7. Nhãn cạnh ngắn (một đến ba từ). Công cụ tự đặt nhãn sao cho chữ không đè lên đường, dấu gạch chéo hay node; nếu không đặt được, kiểm tra báo lỗi và bạn đổi vị trí node.

Mọi sơ đồ được vẽ ở bề rộng của cột bài viết (1600px), nên kích thước ô và chữ giống nhau giữa các sơ đồ.
