-- Seed file for local course: seed-course-skills-demo
-- Provides >= 2 lessons for each of the 4 lesson types:
-- 1. Video (with valid YouTube URLs)
-- 2. Article (with Markdown content)
-- 3. Quiz (with MCQ questions in course_section_questions)
-- 4. Practice (with Markdown practice exercises and instructions)

BEGIN;

-- 1. Upsert course record
INSERT INTO public.courses (id, instructor_id, published, slug, data)
VALUES (
  'seed-course-skills-demo',
  '78d492c8-8ff4-4eb1-8883-45e7080727ae',
  true,
  'seed-course-skills-demo',
  jsonb_build_object(
    'title', 'Web3 & Smart Contract Engineering Masterclass',
    'short_description', 'Khóa học đầy đủ 4 format bài học: Video YouTube, Bài đọc chuyên sâu, Trắc nghiệm Quiz và Thực hành Practice.',
    'description', 'Khóa học toàn diện trang bị kiến thức từ nền tảng Blockchain, EVM, lập trình Solidity cho tới kiểm thử và bảo mật Smart Contract. Tích hợp đầy đủ các dạng nội dung học tập tương tác cao trên Corelia Academy.',
    'instructor_name', 'Lê Thanh Hậu',
    'level', 'beginner',
    'access_model', 'free',
    'has_sections', true,
    'skills', jsonb_build_array('Web3', 'Blockchain', 'Solidity', 'EVM', 'Foundry', 'DeFi Security'),
    'learning_outcomes', jsonb_build_array(
      'Hiểu rõ cấu trúc mạng ngang hàng P2P, cơ chế đồng thuận và mô hình phân tán Web3.',
      'Nắm vững kiến trúc máy ảo EVM, cơ chế quản lý Gas, Memory và Storage.',
      'Viết và triển khai Smart Contract an toàn bằng ngôn ngữ Solidity.',
      'Phát hiện và phòng chống các lỗ hổng bảo mật phổ biến như Reentrancy, Overflow.',
      'Làm chủ quy trình Unit Testing và Fuzzing Smart Contract bằng Foundry CLI.'
    ),
    'i18n', jsonb_build_object(
      'supported_locales', jsonb_build_array('vi', 'en'),
      'primary_content_locale', 'vi',
      'default_video_primary_locale', 'vi',
      'subtitle_note_policy', 'suggest'
    )
  )
)
ON CONFLICT (id) DO UPDATE
SET instructor_id = EXCLUDED.instructor_id,
    published = EXCLUDED.published,
    slug = EXCLUDED.slug,
    data = EXCLUDED.data,
    updated_at = now();

-- 2. Cleanup existing child data for this course
DELETE FROM public.section_question_attempts WHERE course_id = 'seed-course-skills-demo';
DELETE FROM public.course_section_questions WHERE course_id = 'seed-course-skills-demo';
DELETE FROM public.course_lesson_locales WHERE course_id = 'seed-course-skills-demo';
DELETE FROM public.course_lessons WHERE course_id = 'seed-course-skills-demo';
DELETE FROM public.course_section_locales WHERE course_id = 'seed-course-skills-demo';
DELETE FROM public.course_sections WHERE course_id = 'seed-course-skills-demo';

-- 3. Create Sections
INSERT INTO public.course_sections (course_id, id, sort_order, data)
VALUES
  (
    'seed-course-skills-demo',
    'sec-web3-foundations',
    1,
    jsonb_build_object(
      'title', 'Phần 1: Nền Tảng Blockchain & Kiến Trúc EVM',
      'description', 'Khái quát mạng lưới phi tập trung, nguyên lý máy ảo Ethereum và cách thức giao dịch on-chain vận hành.'
    )
  ),
  (
    'seed-course-skills-demo',
    'sec-solidity-security',
    2,
    jsonb_build_object(
      'title', 'Phần 2: Lập Trình Solidity & Bảo Mật Smart Contract',
      'description', 'Kỹ thuật viết mã Solidity chuyên sâu, các mô hình bảo mật và kiểm thử tự động với Foundry.'
    )
  );

-- 4. Create Lessons (8 lessons: 2 video, 2 article, 2 quiz, 2 practice)

-- Section 1 Lessons
-- Lesson 1: Video (Format 1 - Video 1)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-01-intro-video',
  'sec-web3-foundations',
  1,
  jsonb_build_object(
    'title', '1. Tổng Quan Kiến Trúc Mạng Blockchain & Web3',
    'lesson_format', 'video',
    'youtube_url', 'https://www.youtube.com/watch?v=gyMwXuJrbVQ',
    'duration_seconds', 900,
    'is_preview_free', true,
    'short_description', 'Video giới thiệu chi tiết về mô hình mạng ngang hàng P2P, cơ chế khối Block và chuỗi liên kết mật mã học.',
    'description_markdown', $MD$Trong bài học video này, bạn sẽ được tìm hiểu tổng quan về cách một mạng phi tập trung đồng bộ hóa trạng thái giữa hàng ngàn node độc lập mà không cần một máy chủ trung tâm.$MD$
  )
);

-- Lesson 2: Article (Format 2 - Article 1)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-02-evm-article',
  'sec-web3-foundations',
  2,
  jsonb_build_object(
    'title', '2. Đọc Hiểu Chuyên Sâu: Máy Ảo EVM & Cơ Chế Gas',
    'lesson_format', 'article',
    'duration_seconds', 720,
    'is_preview_free', true,
    'short_description', 'Tài liệu chi tiết về kiến trúc Stack-based của Ethereum Virtual Machine, mô hình bộ nhớ (Stack, Memory, Storage) và cách tính Gas.',
    'description_markdown', $MD$## 1. Giới thiệu về Ethereum Virtual Machine (EVM)

Ethereum Virtual Machine (EVM) là một máy ảo trạng thái phi tập trung đóng vai trò trái tim của mạng lưới Ethereum. Mọi node tham gia mạng lưới đều duy trì một bản sao EVM giống hệt nhau để thực thi các chỉ thị mã bytecode (Opcode).

```
+--------------------------------------------------------+
|                     EVM Architecture                   |
|                                                        |
|   +---------------+   +---------------+   +--------+   |
|   |  Stack (1024) |   |    Memory     |   |Storage |   |
|   |  (Volatile)   |   |  (Volatile)   |   |(State) |   |
|   +---------------+   +---------------+   +--------+   |
|           ^                   ^                ^       |
|           |                   |                |       |
|           +----------- EVM Code Interpreter ---+       |
+--------------------------------------------------------+
```

### 2. Ba vùng lưu trữ cốt lõi trong EVM

1. **Stack:**
   - Hoạt động theo cơ chế LIFO (Last In First Out), tối đa 1024 phần tử, mỗi phần tử có kích thước 256-bit (32 bytes).
   - Chi phí truy cập rất rẻ (khoảng 3 Gas mỗi phép tính cơ bản).

2. **Memory:**
   - Bộ nhớ tạm thời dạng byte-array mở rộng linh hoạt trong thời gian thực thi transaction.
   - Bị xóa sạch ngay khi giao dịch kết thúc. Chi phí Gas tăng tuyến tính ban đầu và tăng bậc hai khi kích thước lớn.

3. **Storage:**
   - Không gian lưu trữ vĩnh viễn trên state blockchain (Key-Value map 32 bytes -> 32 bytes).
   - Chi phí thao tác đắt nhất (ghi mới vào một slot rỗng tốn tới 20,000 Gas - `SSTORE`).

---

### 3. Cơ Chế Tính Phí Gas (EIP-1559)

Kể từ EIP-1559, tổng chi phí cho một giao dịch được tính theo công thức:

$$\text{Total Fee} = \text{Gas Used} \times (\text{Base Fee} + \text{Priority Fee})$$

- **Base Fee:** Mức phí cơ bản do mạng tự động điều chỉnh theo độ nghẽn của block trước đó, lượng phí này sẽ bị đốt cháy (burn).
- **Priority Fee (Tip):** Phần thưởng trả trực tiếp cho validator để ưu tiên đưa transaction vào block sớm.$MD$
  )
);

-- Lesson 3: Quiz (Format 3 - Quiz 1)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-03-foundations-quiz',
  'sec-web3-foundations',
  3,
  jsonb_build_object(
    'title', '3. Trắc Nghiệm: Đánh Giá Nền Tảng Web3 & EVM',
    'lesson_format', 'quiz',
    'duration_seconds', 300,
    'is_preview_free', false,
    'short_description', 'Bài kiểm tra trắc nghiệm 3 câu hỏi đánh giá mức độ tiếp thu kiến trúc máy ảo EVM và cơ chế phí Gas.'
  )
);

-- Lesson 4: Practice (Format 4 - Practice 1)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-04-node-practice',
  'sec-web3-foundations',
  4,
  jsonb_build_object(
    'title', '4. Thử Thách Thực Hành: Khởi Chạy Local RPC Node & Tương Tác JSON-RPC',
    'lesson_format', 'practice',
    'duration_seconds', 900,
    'is_preview_free', false,
    'practice_source_lesson_id', 'lesson-02-evm-article',
    'short_description', 'Thực hành tương tác trực tiếp với node blockchain qua giao thức JSON-RPC bằng công cụ dòng lệnh curl hoặc cast.',
    'description_markdown', $MD$### 🎯 Mục tiêu bài thực hành

Làm quen với việc giao tiếp trực tiếp với một node EVM thông qua cổng JSON-RPC API chuẩn mà không cần thông qua thư viện trung gian.

---

### 📋 Hướng dẫn từng bước

#### Bước 1: Khởi động node mô phỏng cục bộ
Nếu bạn đã cài đặt Foundry, hãy mở terminal và chạy:
```bash
anvil --port 8545
```

#### Bước 2: Gửi truy vấn lấy Block Number hiện tại
Sử dụng `curl` để gọi phương thức `eth_blockNumber`:
```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

#### Bước 3: Lấy số dư của tài khoản mặc định
```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "latest"],"id":2}'
```

---

### 📌 Yêu cầu hoàn thành (Deliverables)
1. Ghi lại kết quả trả về mã HEX của `eth_blockNumber` và quy đổi sang hệ thập phân.
2. Xác nhận số dư 10,000 ETH mặc định của tài khoản kiểm thử Anvil.
3. Nhấp nút **"Đánh dấu hoàn thành"** khi đã hoàn tất thao tác.$MD$
  )
);

-- Section 2 Lessons
-- Lesson 5: Video (Format 1 - Video 2)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-05-solidity-video',
  'sec-solidity-security',
  1,
  jsonb_build_object(
    'title', '5. Lập Trình Smart Contract Với Ngôn Ngữ Solidity',
    'lesson_format', 'video',
    'youtube_url', 'https://www.youtube.com/watch?v=M576WGiDBdQ',
    'duration_seconds', 1200,
    'is_preview_free', false,
    'short_description', 'Video bài giảng thực tế về cú pháp Solidity 0.8+, khai báo biến trạng thái, cấu trúc Mapping và phát xạ Event.',
    'description_markdown', $MD$Bài giảng video hướng dẫn thực hành viết hợp đồng lưu trữ số dư phi tập trung, giải thích modifier, visibility (`public`, `external`, `internal`, `private`) và tối ưu Gas.$MD$
  )
);

-- Lesson 6: Article (Format 2 - Article 2)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-06-security-article',
  'sec-solidity-security',
  2,
  jsonb_build_object(
    'title', '6. Đọc Hiểu Chuyên Sâu: Các Lỗ Hổng Bảo Mật Smart Contract Kinh Điển',
    'lesson_format', 'article',
    'duration_seconds', 840,
    'is_preview_free', false,
    'short_description', 'Phân tích chi tiết lỗ hổng Reentrancy Attack, lỗi phân quyền Access Control và giải pháp bảo vệ Checks-Effects-Interactions.',
    'description_markdown', $MD$## 1. Lỗ hổng Reentrancy Attack (Tấn Công Tái Nhập)

Lỗ hổng Reentrancy là một trong những nguyên nhân gây ra các vụ hack thiệt hại hàng chục triệu USD trong lịch sử Ethereum (tiêu biểu là vụ The DAO năm 2016).

### 🔍 Cơ chế lỗ hổng:
Khi một contract chuyển ETH cho người dùng bằng `call()` trước khi trừ số dư trên biến trạng thái:

```solidity
// ❌ DỄ BỊ TẤN CÔNG (Vulnerable)
function withdraw() public {
    uint256 bal = balances[msg.sender];
    require(bal > 0, "No balance");

    // Gửi ETH ra ngoài trước khi cập nhật số dư -> Kẻ tấn công gọi lại chính hàm này
    (bool sent, ) = msg.sender.call{value: bal}("");
    require(sent, "Failed to send");

    balances[msg.sender] = 0; // Quá trễ!
}
```

---

### 🛡️ Mô hình phòng vệ: Checks-Effects-Interactions Pattern

Quy tắc bất biến: Luôn thay đổi toàn bộ trạng thái nội bộ (`Effects`) TRƯỚC KHI thực hiện bất kỳ lời gọi hàm hay gửi token ra bên ngoài (`Interactions`).

```solidity
// ✅ AN TOÀN (Protected via CEI Pattern)
function withdraw() public {
    // 1. Checks
    uint256 bal = balances[msg.sender];
    require(bal > 0, "No balance");

    // 2. Effects
    balances[msg.sender] = 0;

    // 3. Interactions
    (bool sent, ) = msg.sender.call{value: bal}("");
    require(sent, "Failed to send");
}
```

Ngoài ra, bạn nên sử dụng `ReentrancyGuard` từ thư viện `@openzeppelin/contracts` với modifier `nonReentrant` để bảo vệ các hàm nhạy cảm.$MD$
  )
);

-- Lesson 7: Quiz (Format 3 - Quiz 2)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-07-security-quiz',
  'sec-solidity-security',
  3,
  jsonb_build_object(
    'title', '7. Trắc Nghiệm: Bảo Mật Hợp Đồng & Quy Chuẩn Kiểm Thử',
    'lesson_format', 'quiz',
    'duration_seconds', 300,
    'is_preview_free', false,
    'short_description', 'Bài trắc nghiệm đánh giá kiến thức về các phương thức phòng chống tấn công Reentrancy và quản lý quyền trong Smart Contract.'
  )
);

-- Lesson 8: Practice (Format 4 - Practice 2)
INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES (
  'seed-course-skills-demo',
  'lesson-08-foundry-practice',
  'sec-solidity-security',
  4,
  jsonb_build_object(
    'title', '8. Thử Thách Thực Hành: Viết Unit Test & Fuzzing Hợp Đồng Với Foundry',
    'lesson_format', 'practice',
    'duration_seconds', 1200,
    'is_preview_free', false,
    'practice_source_lesson_id', 'lesson-06-security-article',
    'short_description', 'Tự tay thiết kế bộ test case cho một Vault Contract bằng Foundry CLI, kiểm tra tính toàn vẹn của logic rút tiền.',
    'description_markdown', $MD$### 🎯 Đề bài thử thách Foundry

Bạn được giao nhiệm vụ viết bộ kiểm thử tự động (Unit Test) cho một Vault Contract để đảm bảo không xảy ra lỗi rút quá số dư.

---

### 📝 Mã nguồn Hợp đồng cần kiểm thử (`src/Vault.sol`):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

---

### 🔨 Yêu cầu viết Test (`test/Vault.t.sol`):

1. **Test `testDeposit()`:** Xác nhận số dư tăng đúng bằng `msg.value`.
2. **Test `testWithdrawSuccess()`:** Nạp 1 ETH và rút thành công 0.5 ETH.
3. **Test `testRevertWhen_WithdrawTooMuch()`:** Xác nhận lệnh rút bị revert với lỗi `"Insufficient balance"` khi số dư không đủ.

Chạy lệnh kiểm tra:
```bash
forge test -vvv
```

Sau khi vượt qua toàn bộ 3 test cases với trạng thái `[PASS]`, bạn hãy đánh dấu hoàn thành bài học!$MD$
  )
);

-- 5. Insert Quiz Questions for Lesson 3 and Lesson 7 into course_section_questions

-- Questions for Lesson 3 (Web3 Foundations Quiz)
INSERT INTO public.course_section_questions (id, course_id, section_id, lesson_id, sort_order, data)
VALUES
  (
    'q-foundations-001',
    'seed-course-skills-demo',
    NULL,
    'lesson-03-foundations-quiz',
    0,
    jsonb_build_object(
      'question', 'EVM là viết tắt của cụm từ nào dưới đây?',
      'type', 'mcq',
      'options', jsonb_build_array(
        'Ethereum Virtual Machine',
        'Ether Value Management',
        'Ethereum Verified Module',
        'External Variable Memory'
      ),
      'correct_index', 0,
      'explanation', 'EVM là viết tắt của Ethereum Virtual Machine - máy ảo thực thi smart contract trên mạng lưới Ethereum.',
      'locale', 'vi'
    )
  ),
  (
    'q-foundations-002',
    'seed-course-skills-demo',
    NULL,
    'lesson-03-foundations-quiz',
    1,
    jsonb_build_object(
      'question', 'Trong kiến trúc EVM, vùng lưu trữ nào có chi phí Gas đắt nhất khi ghi dữ liệu mới?',
      'type', 'mcq',
      'options', jsonb_build_array(
        'Stack',
        'Memory',
        'Storage',
        'Calldata'
      ),
      'correct_index', 2,
      'explanation', 'Storage lưu trữ vĩnh viễn trên state của blockchain nên lệnh SSTORE ghi dữ liệu mới tiêu tốn lượng Gas lớn nhất (lên tới 20,000 Gas).',
      'locale', 'vi'
    )
  ),
  (
    'q-foundations-003',
    'seed-course-skills-demo',
    NULL,
    'lesson-03-foundations-quiz',
    2,
    jsonb_build_object(
      'question', 'Theo chuẩn EIP-1559, phần Base Fee của mỗi transaction sẽ được xử lý như thế nào?',
      'type', 'mcq',
      'options', jsonb_build_array(
        'Được trả hoàn toàn cho Validator đóng block',
        'Bị đốt cháy vĩnh viễn (Burn) khỏi tổng cung',
        'Chuyển vào quỹ phát triển Ethereum Foundation',
        'Hoàn trả lại một phần cho người gửi giao dịch'
      ),
      'correct_index', 1,
      'explanation', 'Theo EIP-1559, lượng Base Fee sẽ bị tiêu hủy (burn), còn phần Priority Fee (Tip) mới được thưởng cho validator.',
      'locale', 'vi'
    )
  );

-- Questions for Lesson 7 (Security Quiz)
INSERT INTO public.course_section_questions (id, course_id, section_id, lesson_id, sort_order, data)
VALUES
  (
    'q-security-001',
    'seed-course-skills-demo',
    NULL,
    'lesson-07-security-quiz',
    0,
    jsonb_build_object(
      'question', 'Mô hình Checks-Effects-Interactions (CEI) khuyến nghị điều gì để phòng chống tấn công Reentrancy?',
      'type', 'mcq',
      'options', jsonb_build_array(
        'Gọi external contract trước khi cập nhật biến trạng thái',
        'Cập nhật toàn bộ biến trạng thái nội bộ trước khi gọi external contract',
        'Sử dụng tx.origin để xác thực thay vì msg.sender',
        'Chỉ dùng hàm transfer() thay cho call()'
      ),
      'correct_index', 1,
      'explanation', 'CEI pattern yêu cầu cập nhật state (Effects) xong xuôi mới tương tác ra ngoài (Interactions) để nếu đối phương cố re-enter thì state đã thay đổi.',
      'locale', 'vi'
    )
  ),
  (
    'q-security-002',
    'seed-course-skills-demo',
    NULL,
    'lesson-07-security-quiz',
    1,
    jsonb_build_object(
      'question', 'Công cụ CLI nào trong hệ sinh thái Foundry được sử dụng để thực thi Unit Test và Invariant Test?',
      'type', 'mcq',
      'options', jsonb_build_array(
        'Anvil',
        'Cast',
        'Forge',
        'Chisel'
      ),
      'correct_index', 2,
      'explanation', 'Forge là công cụ cốt lõi trong Foundry dùng để compile, test, fuzz và deploy smart contract.',
      'locale', 'vi'
    )
  ),
  (
    'q-security-003',
    'seed-course-skills-demo',
    NULL,
    'lesson-07-security-quiz',
    2,
    jsonb_build_object(
      'question', 'Từ phiên bản Solidity 0.8.0 trở đi, lỗi tràn số nguyên (Arithmetic Overflow/Underflow) được xử lý như thế nào mặc định?',
      'type', 'mcq',
      'options', jsonb_build_array(
        'Tự động quay vòng về 0 hoặc Max Value mà không báo lỗi',
        'Tự động revert transaction khi phát hiện tràn số',
        'Bắt buộc lập trình viên phải import thư viện SafeMath',
        'Tự động chuyển đổi sang kiểu dữ liệu lớn hơn'
      ),
      'correct_index', 1,
      'explanation', 'Solidity 0.8.0+ tích hợp sẵn bộ kiểm tra tràn số ở cấp độ compiler và sẽ tự động revert khi xảy ra overflow/underflow.',
      'locale', 'vi'
    )
  );

COMMIT;
