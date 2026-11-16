Mẫu về cỡ khóa, nhịp module và cách viết. Không chép dữ kiện; dữ kiện của khóa khác phải lấy từ research của khóa đó.

# Mẫu chuẩn: Thiết kế program Solana với Anchor

Bản nháp để duyệt hướng nội dung. Mọi dữ kiện kỹ thuật lấy từ docs chính thức, ghi nguồn ở cuối mỗi module. Mục ghi `[CẦN XÁC MINH]` chưa có trong các trang đã đọc, phải kiểm ở bước research trước khi viết bài thật.

## Thông tin khóa

- **Đối tượng:** lập trình viên đã viết được Rust cơ bản (struct, enum, `Result`) và đã dùng ví, Devnet. Muốn tự viết program cho app thay vì chỉ gọi program có sẵn.
- **Điểm xuất phát (P2):** Rust cơ bản; TypeScript đủ đọc file test; đã cài Anchor CLI và Solana CLI. Bước cài nằm trong phần "Trước khi bắt đầu" của bài có thực hành đầu tiên, không thành module riêng.
- **Lời hứa (P1):** Thiết kế account, PDA và CPI cho program Anchor của một app, rồi chặn được các lỗ hổng phổ biến trước khi deploy.
- **Ngôn ngữ code:** `rust` (code_exercise chấm so khớp chuỗi, không biên dịch). Phần viết và chạy thật nằm ở practice và bài cuối khóa.
- **Quan hệ với catalog:** `solana-bootcamp` mới publish các bài dự án; bài khái niệm của bootcamp đang là nháp nên theo rule hiện tại không tính là đã phủ. Nếu team định publish các bài nháp đó, cần chốt khóa này thay thế hay bổ sung cho bootcamp.

## Outcome

| ID | Outcome (hành động quan sát được) | Kiểm bằng |
|---|---|---|
| O1 | Thiết kế các account cho một chức năng của app: chọn owner, ước tính kích thước và khoản lamport tối thiểu phải giữ | Quiz M1, bài cuối khóa |
| O2 | Chọn seed PDA cho state của từng user, account config dùng chung và vault, và giải thích vì sao seed đó không trùng | Code M2, quiz M2, bài cuối khóa |
| O3 | Viết lời gọi CPI có PDA ký thay, và chẩn đoán lỗi thiếu quyền signer hoặc writable từ log | Code M3, quiz M3, practice M3 |
| O4 | Đọc một handler Anchor, chỉ ra lỗ hổng thuộc nhóm phổ biến và thêm đúng ràng buộc để chặn | Code M4, quiz M4, bài cuối khóa |
| O5 | Ước tính và giảm compute unit của một instruction, rồi đặt compute unit limit hợp lý | Quiz M5, final check |

## Module 1 — Thiết kế state của app thành account

**Mô hình:** mọi state nằm trong account; chỉ program owner mới được sửa data hoặc trừ lamport của account; account càng lớn thì khoản lamport phải giữ càng nhiều.
**Tận dụng khi build app:** quyết định tách state thành một account lớn hay nhiều account nhỏ; ước tính chi phí lưu trữ cho mỗi user trước khi làm.
**Bẫy:** quên dành chỗ cho dữ liệu mở rộng; nghĩ program "chứa" dữ liệu; để account của user do program khác sở hữu.

| Bài | Loại / purpose | Nội dung |
|---|---|---|
| Dữ liệu của app nằm trong account, không nằm trong program | article / explanation | Tình huống: cùng một program bỏ phiếu, mỗi cuộc bỏ phiếu có số phiếu riêng. Vì sao? Năm trường của account, luật owner, ví dụ một account bỏ phiếu. Nêu lời hứa của khóa |
| Ước tính kích thước và tiền giữ chỗ cho một account | article / worked_example | Lời giải mẫu: thiết kế account bỏ phiếu, cộng kích thước từng trường, tính khoản tối thiểu theo công thức của runtime |
| Program nào được sửa account này | quiz / supported_practice | 5 câu dự đoán: instruction có sửa được data, trừ được lamport, cộng được lamport không, khi biết owner |
| Khai báo account bỏ phiếu trong Anchor | code_exercise fill / supported_practice | Điền kiểu trường và giá trị `space` của account (2–3 chỗ điền). `reinforces`: kích thước account quyết định tiền giữ chỗ |
| Chọn một account lớn hay nhiều account nhỏ | quiz / independent_practice | 5 tình huống app (danh sách người tham gia tăng dần, dữ liệu theo từng user…), chọn thiết kế và lý do |

Nguồn: solana.com/docs/core/accounts (năm trường; luật owner; công thức `(account_size + 128) * 3,480 lamports/byte-year * 2 years`; giới hạn 10 MiB, tăng tối đa 10 KiB mỗi instruction); anchor docs basics/pda (`space` gồm 8 byte discriminator).

## Module 2 — Dùng PDA làm địa chỉ cho state

**Mô hình:** PDA là địa chỉ tính ra được từ seed và program id, nằm ngoài đường cong Ed25519 nên không có private key; chỉ program dùng để tính mới "ký" được cho nó.
**Tận dụng khi build app:** state theo từng user (`["user", user_pubkey]`), account config dùng chung (seed cố định), vault do program giữ quyền; app tìm lại account bằng cách tính, không cần lưu địa chỉ.
**Bẫy:** hai loại account dùng seed trùng nhau; dùng bump không chuẩn; không kiểm account truyền vào có đúng là PDA tính ra không; gọi `find_program_address` nhiều lần làm tốn compute.

| Bài | Loại / purpose | Nội dung |
|---|---|---|
| PDA cho app một địa chỉ tìm lại được mà không cần khóa | article / explanation | Bài mẫu viết đầy đủ ở cuối file |
| Chọn seed cho state của từng user và config chung | article / worked_example | Lời giải mẫu: app bỏ phiếu cần account config, account cho từng cuộc bỏ phiếu, account phiếu của từng người. Chọn seed, giải thích vì sao không trùng |
| Khai báo PDA bằng ràng buộc seeds và bump | code_exercise fill / supported_practice | Điền mảng `seeds` và `bump` của account phiếu (3 chỗ điền). `reinforces`: seed quyết định mỗi người chỉ có một account phiếu |
| Hai account này có thể trùng địa chỉ không | quiz / independent_practice | 5 câu: cho các bộ seed, dự đoán trùng hay không, PDA nào ai ký được, khi nào derivation phải thử bump khác |
| Gọi lại cách tính kích thước account | quiz / recall | 2–3 câu gọi lại Module 1 |

Nguồn: solana.com/docs/core/pda (xác định, ngoài đường cong, không private key, chỉ program ký qua `invoke_signed`; tối đa 16 seed, mỗi seed 32 byte; bump 0–255; `create_program_address` 1.500 CU; `find_program_address` 1.500 CU cộng 1.500 CU mỗi bump thử thất bại); solana.com/docs/core/pda/pda-derivation (luôn dùng canonical bump); anchor docs basics/pda (`seeds` và `bump` dùng cùng nhau, `seeds::program`).

## Module 3 — Cho program ký thay PDA khi gọi CPI

**Mô hình:** CPI là program gọi instruction của program khác; quyền signer và writable truyền từ bên gọi xuống bên được gọi, không được nâng thêm. Program ký cho PDA của mình bằng signer seeds.
**Tận dụng khi build app:** vault do PDA giữ để chuyển SOL hoặc token theo luật của program; escrow; gọi Token Program hay System Program từ program của app.
**Bẫy:** truyền account read-only rồi bên được gọi cần ghi; quên signer seeds; gọi tới program id không kiểm (arbitrary CPI); vượt độ sâu CPI.

| Bài | Loại / purpose | Nội dung |
|---|---|---|
| Quyền signer và writable đi theo lời gọi CPI | article / explanation | Tình huống: lệnh rút tiền từ vault báo lỗi thiếu quyền dù người dùng đã ký. Bảng luật truyền quyền, `invoke` và `invoke_signed` |
| Rút SOL từ vault do PDA giữ | article / worked_example | Lời giải mẫu: handler rút tiền, `CpiContext` có signer seeds, vì sao vault là PDA chứ không phải ví |
| Điền signer seeds cho lời gọi chuyển tiền | code_exercise fill / supported_practice | Điền signer seeds và account đích (3 chỗ điền). `reinforces`: program ký cho PDA bằng đúng seed đã dùng để tính |
| Chạy test rút tiền từ vault trên máy | practice / independent_practice | Checklist: chạy `anchor test` với một repo mẫu, đọc log khi bỏ signer seeds, sửa lại cho test qua. Bước tự tick, nên outcome O3 được kiểm thêm bằng quiz và bài cuối khóa |
| Đọc log để tìm quyền còn thiếu | quiz / independent_practice | 5 câu: cho log lỗi CPI, chọn nguyên nhân và cách sửa |
| Gọi lại seed và PDA | quiz / recall | 2–3 câu gọi lại Module 2 |

Nguồn: solana.com/docs/core/cpi (quyền chỉ truyền, không nâng; callee dùng chung ngân sách compute; tái nhập gián tiếp A→B→A bị chặn; độ sâu tối đa 5, 9 với SIMD-0268; CPI tốn 1.000 CU; tối đa 16 PDA signer); solana.com/docs/core/cpi/cpi-execution (bảng luật quyền, PDA được thành signer khi tính từ seed của bên gọi).

## Module 4 — Chặn lỗ hổng phổ biến của program

**Mô hình:** runtime không tự kiểm account nào là đúng; program phải tự kiểm người ký, owner, kiểu dữ liệu và quan hệ giữa các account. Ràng buộc của Anchor là cách khai báo các kiểm tra đó.
**Tận dụng khi build app:** dùng bảng "nhóm lỗ hổng → ràng buộc Anchor" làm checklist review trước khi deploy.
**Bẫy:** dùng `UncheckedAccount`/`AccountInfo` mà không tự kiểm; tin account do client truyền lên; đóng account sai cách rồi bị dùng lại.

| Bài | Loại / purpose | Nội dung |
|---|---|---|
| Program phải tự kiểm mọi account người dùng truyền lên | article / explanation | Tình huống: một handler cho phép bất kỳ ai rút tiền của người khác. Các nhóm lỗ hổng của Sealevel Attacks, mỗi nhóm kèm ràng buộc Anchor chặn nó |
| Review một handler trước khi deploy | article / worked_example | Lời giải mẫu: đi qua từng account của một handler, ghi kiểm tra còn thiếu, thêm `Signer`, `has_one`, `seeds`/`bump`, `close` |
| Thêm ràng buộc còn thiếu vào handler | code_exercise fill / supported_practice | Điền 3–4 ràng buộc còn thiếu. `reinforces`: mỗi account phải có kiểm tra người ký, owner hoặc quan hệ |
| Tìm lỗ hổng trong đoạn code cho sẵn | quiz / independent_practice | 6 câu: mỗi câu một handler, chọn nhóm lỗ hổng và ràng buộc sửa đúng |
| Gọi lại CPI và quyền | quiz / recall | 2–3 câu gọi lại Module 3, gồm arbitrary CPI |

Nguồn: github.com/coral-xyz/sealevel-attacks (11 nhóm: signer authorization, account data matching, owner checks, type cosplay, initialization, arbitrary CPI, duplicate mutable accounts, bump seed canonicalization, PDA sharing, closing accounts, sysvar address checking); anchor docs references/account-constraints (`signer`, `mut`, `dup`, `init`, `seeds`/`bump`, `has_one`, `address`, `owner`, `close`, `constraint`, `realloc`); anchor docs references/account-types (`Account<'info, T>` kiểm owner khi deserialize).
`[CẦN XÁC MINH]`: giải thích cụ thể từng nhóm lấy từ mã nguồn từng thư mục trong repo, chưa đọc.

## Module 5 — Giữ instruction trong ngân sách compute

**Mô hình:** mỗi instruction có ngân sách compute unit; priority fee tính theo compute unit limit đã xin, không theo lượng thực dùng; lời gọi CPI và việc tìm PDA đều tốn compute.
**Tận dụng khi build app:** đo compute thật của từng instruction, đặt limit vừa đủ để không trả phí thừa; lưu bump vào account để không phải tìm lại.
**Bẫy:** để limit mặc định rồi trả priority fee cho phần không dùng; gọi `find_program_address` trong vòng lặp.

| Bài | Loại / purpose | Nội dung |
|---|---|---|
| Phí của transaction tính từ chữ ký và compute đã xin | article / explanation | Phí cơ bản 5.000 lamport mỗi chữ ký, priority fee, compute unit limit và price |
| Đo compute của instruction rồi đặt limit | article / worked_example | Lời giải mẫu: đọc lượng compute đã dùng trong log test, đặt limit có khoảng dư |
| Dùng bump đã lưu thay vì tìm lại | code_exercise fill / supported_practice | Điền chỗ đọc bump đã lưu trong account (2 chỗ điền). `reinforces`: mỗi lần tìm PDA tốn compute |
| Instruction này tốn bao nhiêu compute | quiz / independent_practice | 5 câu ước tính và chọn cách giảm; 1 câu gọi lại lỗ hổng bump không chuẩn của Module 4 qua `review_lesson_ids` |
| Tự kiểm thiết kế program trước bài cuối khóa | quiz / final_check | 6 câu tình huống mới phủ O1–O5 |

Nguồn: solana.com/docs/core/fees/fee-structure (5.000 lamport mỗi chữ ký, 50% bị đốt; 200.000 CU mặc định cho mỗi instruction không phải builtin; priority fee tính theo limit đã xin); solana.com/docs/core/pda và cpi (chi phí CU ở trên).
`[CẦN XÁC MINH]`: trần compute của một transaction; chi phí của log.

## Bài cuối khóa (P7)

- **Tình huống mới:** một câu lạc bộ cần quỹ chung. Thành viên nạp SOL; chỉ khi đủ số thành viên duyệt thì một khoản chi mới được rút.
- **Nộp:** `github_url` (program Anchor tối thiểu cho chức năng nạp và duyệt, kèm test) và `notes` giải thích: các account và owner; seed của từng PDA và vì sao không trùng; lời gọi CPI nào cần PDA ký; checklist lỗ hổng đã chặn; compute limit đã đặt.
- **Tiêu chí chấm công bố:** thiết kế account có kích thước và chi phí giữ chỗ hợp lý; seed không cho phép hai thành viên ghi đè nhau; mọi account trong handler rút tiền có kiểm tra phù hợp; test có trường hợp người không đủ quyền bị từ chối; notes giải thích được từng lựa chọn.
- **Code là một phần:** phần chấm chính là thiết kế và notes; program chỉ cần đủ để chứng minh thiết kế chạy được.

---

## Bài mẫu viết đầy đủ — PDA cho app một địa chỉ tìm lại được mà không cần khóa

**Trước khi bắt đầu**

- Bạn đã biết mỗi account có owner, và chỉ program owner mới sửa được data của account. Nếu cần ôn, xem lại Part A, Bài 1.
- Bạn đọc được một struct Rust và một mảng byte. Bài này chưa cần chạy lệnh nào.

Sau bài này, bạn chọn được seed để mỗi user có đúng một account state, và giải thích được vì sao program ký được cho địa chỉ đó dù không ai giữ private key.

Giả sử bạn đang làm app bỏ phiếu. Mỗi người chỉ được bỏ một phiếu cho mỗi cuộc bỏ phiếu, và phiếu đó phải nằm trong một account riêng. Lúc người dùng mở app lần thứ hai, app cần tìm lại account phiếu của họ để hiện "Bạn đã bỏ phiếu". App không có database riêng. Vậy app tìm lại account đó bằng cách nào, khi địa chỉ của nó không được lưu ở đâu cả?

## Địa chỉ của account có thể được tính ra thay vì được tạo ngẫu nhiên

Câu trả lời là app không cần lưu địa chỉ, vì địa chỉ đó tính lại được. Một ví thông thường có địa chỉ là public key của một cặp khóa sinh ngẫu nhiên, nên muốn biết địa chỉ thì phải lưu nó lại. Program Derived Address (PDA) thì khác: địa chỉ được tính từ một danh sách seed và program id. Cùng seed và cùng program id thì luôn ra cùng một địa chỉ.

Với app bỏ phiếu, chúng ta chọn seed là chữ `"vote"`, địa chỉ cuộc bỏ phiếu và public key của người bỏ phiếu. Lần đầu, program tạo account phiếu tại địa chỉ tính từ ba seed đó. Lần sau, app chỉ cần biết người dùng là ai và đang xem cuộc bỏ phiếu nào để tính lại đúng địa chỉ, rồi đọc account.

Sơ đồ đề xuất cho mục này: ba ô seed (`"vote"`, *Cuộc bỏ phiếu*, *Người bỏ phiếu*) và ô *Program id* cùng đi vào một ô *Tính địa chỉ*, ra ô *Account phiếu*. Một mũi tên từ ô *App* quay lại ô *Tính địa chỉ*, ghi "tính lại, không cần lưu".

## Không ai có private key của PDA, nên chỉ program ký được cho nó

Phép tính PDA được thiết kế để địa chỉ nằm ngoài đường cong Ed25519, tức không phải là public key của bất kỳ cặp khóa nào. Vì vậy không ai tạo được chữ ký cho địa chỉ đó. Khi phép tính lỡ ra một điểm nằm trên đường cong, runtime thêm một byte gọi là bump vào cuối danh sách seed và thử lại, từ 255 giảm dần. Giá trị đầu tiên cho kết quả hợp lệ gọi là canonical bump.

Điều này cho app một tính chất quan trọng: người dùng không thể tự ký thay PDA để sửa account phiếu của chính mình. Chỉ program có program id dùng trong phép tính mới "ký" được cho PDA, và nó làm việc đó qua `invoke_signed` khi gọi sang program khác. Ở Part C, chúng ta sẽ dùng chính tính chất này để program giữ quyền chi tiền của một vault.

## Seed quyết định ai có account riêng và ai dùng chung

Chọn seed là chọn quy tắc "mỗi thứ gì có một account". Docs của Solana nêu mẫu dùng public key của user làm seed để tạo state riêng cho từng user, ví dụ `["user", user_pubkey]`. Trong app bỏ phiếu:

- Account config của app dùng một seed cố định như `["config"]`, nên cả program chỉ có một account config.
- Account cuộc bỏ phiếu dùng `["poll", poll_id]`, nên mỗi cuộc bỏ phiếu có một account.
- Account phiếu dùng `["vote", poll_pubkey, voter_pubkey]`, nên mỗi người chỉ có một account phiếu cho mỗi cuộc. Nếu người đó bỏ phiếu lần nữa, địa chỉ tính ra trùng account đã có, và lệnh tạo account thất bại. Nhờ vậy quy tắc "một người một phiếu" được chính địa chỉ bảo đảm.

Để ý chỗ này nhé: nếu bỏ `voter_pubkey` khỏi seed, mọi người sẽ dùng chung một account phiếu cho một cuộc bỏ phiếu. Thiếu một seed là đổi hẳn quy tắc của app.

## Ba lỗi hay gặp khi chọn seed

Lỗi thứ nhất là hai loại account dùng seed có thể trùng nhau. Nếu account phiếu dùng `[poll_pubkey, voter_pubkey]` và một loại account khác cũng dùng hai public key làm seed, hai loại có thể rơi vào cùng địa chỉ. Một tiền tố riêng như `"vote"` giúp tách chúng ra.

Lỗi thứ hai là dùng bump không chuẩn. Docs khuyên luôn dùng canonical bump. Nếu program chấp nhận bump bất kỳ do client gửi lên, cùng một bộ seed có thể ứng với nhiều địa chỉ, và quy tắc "mỗi người một account" không còn đúng.

Lỗi thứ ba là tìm lại PDA quá nhiều lần. Mỗi lần thử một bump tốn 1.500 compute unit, nên việc tìm canonical bump có thể tốn vài lần như vậy. Cách thường dùng là tìm một lần lúc tạo account, lưu bump vào account, và các lần sau dùng bump đã lưu.

## Anchor khai báo PDA ngay trong danh sách account

Trong Anchor, bạn khai báo seed và bump bằng ràng buộc của account. Anchor tính địa chỉ từ seed và kiểm account người dùng truyền lên có đúng địa chỉ đó không.

```rust
#[account(
    init,
    payer = voter,
    // 8 byte discriminator + poll (32) + voter (32) + choice (1) + bump (1)
    space = 8 + 32 + 32 + 1 + 1,
    seeds = [b"vote", poll.key().as_ref(), voter.key().as_ref()],
    bump
)]
pub vote: Account<'info, Vote>,
```

Đọc từ trên xuống: `init` tạo account mới, `payer` là người trả tiền giữ chỗ, `space` là số byte cấp cho account (gồm 8 byte discriminator mà Anchor dùng để nhận kiểu account), `seeds` là ba seed đã chọn, và `bump` để Anchor dùng canonical bump. Trường `bump` trong struct là chỗ lưu bump để các lần sau không phải tìm lại. Nếu client truyền lên một account không khớp địa chỉ tính từ seed, lệnh bị từ chối trước khi handler chạy.

## Quay lại câu hỏi ban đầu

App tìm lại account phiếu bằng cách tính lại địa chỉ từ `"vote"`, cuộc bỏ phiếu và người dùng, không cần lưu địa chỉ ở đâu. Cũng chính seed đó bảo đảm mỗi người chỉ có một phiếu, và vì PDA không có private key nên chỉ program mới thay đổi được account phiếu. Ở bài tiếp theo, bạn sẽ tự chọn seed cho account config và account cuộc bỏ phiếu, rồi điền ràng buộc `seeds` và `bump` trong Anchor.

Nguồn: solana.com/docs/core/pda; solana.com/docs/core/pda/pda-derivation (tìm bump từ 255 xuống 1; bump không chuẩn tạo địa chỉ thứ hai cho cùng seed); anchor docs basics/pda (`space` gồm 8 byte discriminator; `seeds` và `bump` dùng cùng nhau); anchor docs references/account-constraints.
