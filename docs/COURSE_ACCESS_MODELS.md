# Course Access Models

Tai lieu nay mo ta 3 loai khoa hoc online trong he thong Corelia.

## 1) `free` - Khoa hoc mien phi

- Toan bo bai hoc duoc mo.
- Hoc vien co the hoc ngay.
- Khong co phi bat buoc de vao noi dung.

## 2) `paid_upfront` - Tra phi truoc de mo toan bo

- Hoc vien chua mua chi xem duoc bai hoc thu (lectures co `is_preview_free = true`).
- De mo full noi dung, hoc vien can thanh toan theo `price_vnd`.
- Tam thoi chua tich hop cong thanh toan, nen UI se hien "Sap tich hop thanh toan".

### Quy tac bai hoc thu

- Moi lesson co the danh dau `is_preview_free`.
- Nen co it nhat 1-3 bai hoc thu de tang conversion.
- Neu khong co bai hoc thu, hoc vien chua mua se khong xem duoc video.

## 3) `free_with_paid_certificate` - Hoc mien phi, tra phi de lam chung nhan

- Toan bo bai hoc duoc mo mien phi.
- Neu hoc vien muon nop bai thu hoach/cuoi khoa de giang vien danh gia va cap chung nhan thi can tra `certificate_fee_vnd`.
- Tam thoi chua tich hop thanh toan, nen phi chung nhan moi dung de truyen thong va huong dan.

## Truong du lieu can luu

Trong document `courses`:

- `access_model`: `free` | `paid_upfront` | `free_with_paid_certificate`
- `price_vnd`: so tien VND cho loai `paid_upfront`
- `certificate_fee_vnd`: so tien VND cho loai `free_with_paid_certificate`

Trong subcollection `lessons`:

- `is_preview_free`: true/false, dung cho loai `paid_upfront`

## UX can thong nhat

- Trang giang vien tao/sua khoa hoc:
  - Chon loai khoa hoc.
  - Neu `paid_upfront`: nhap gia va bat lesson hoc thu.
  - Neu `free_with_paid_certificate`: nhap phi chung nhan.
- Trang hoc vien:
  - Hien ro loai truy cap va thong diep gia.
  - Neu `paid_upfront`: khoa lesson khong hoc thu khi chua co quyen full.
  - Neu `free_with_paid_certificate`: thong bao hoc mien phi, phi chi ap dung cho chung nhan.

## Ke hoach tich hop thanh toan (sau nay)

- Tao bang/collection giao dich (`payments`, `orders`).
- Them trang thai quyen truy cap:
  - da mua khoa hoc (`full_access_granted`)
  - da thanh toan phi chung nhan (`certificate_fee_paid`)
- Ket noi webhooks de dong bo trang thai thanh toan.
- Mo khoa noi dung/chuc nang theo trang thai tren.
