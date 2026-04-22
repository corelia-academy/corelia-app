# Course Ownership, Revenue Share, and SePay

Tai lieu nay mo ta mo hinh khoa hoc Corelia vs doi tac, chia doanh thu, ho so doi tac, va luong tich hop SePay cho khoa hoc tra phi.

## 1. Phan loai khoa hoc theo so huu doanh thu

Trong document `courses`:

- `owner_type`:
  - `corelia`: khoa hoc noi bo Corelia, Corelia nhan 100% doanh thu.
  - `external_partner`: khoa hoc giang vien doi tac, chia doanh thu theo ty le cau hinh.
- `platform_revenue_share_percent`: ty le doanh thu nen tang nhan (0-100), ap dung cho `external_partner`.

Quy tac:

- Neu `owner_type = corelia` -> `platform_revenue_share_percent = 100`.
- Neu `owner_type = external_partner` -> giang vien nhan `100 - platform_revenue_share_percent`.

## 2. Ho so hop dong & hoa don doi tac

Trong document `courses`:

- `partner_contract_docs`: danh sach tai lieu hop dong doi tac.
- `partner_invoice_docs`: danh sach tai lieu hoa don/doi soat doi tac.

Moi tai lieu co cau truc:

```json
{
  "name": "hop-dong-2026.pdf",
  "url": "https://...",
  "path": "course-partner-docs/{courseId}/contract/...",
  "uploaded_at": "2026-03-17T12:34:56.000Z",
  "uploaded_by": "uid"
}
```

Quyen:

- Chi `admin` va `support_staff` (hoc vu) duoc cap nhat phan business settings (owner type, revenue share, ho so doi tac).

## 3. Cac loai thanh toan trong khoa hoc

Du lieu da co:

- `access_model`:
  - `free`
  - `paid_upfront`
  - `free_with_paid_certificate`
- `price_vnd`
- `certificate_fee_vnd`

## 4. SePay integration architecture

Khong duoc dua `MERCHANT SECRET KEY` vao frontend.
Frontend chi goi backend de tao checkout session.

Tham khao tai lieu SePay:
- [SePay - Bat dau nhanh](https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau)

### 4.1 Frontend -> Backend

Frontend goi endpoint backend:

- `POST /api/payments/sepay/checkout`

Payload:

```json
{
  "courseId": "course-id",
  "purpose": "course_purchase",
  "amountVnd": 499000,
  "successUrl": "https://app/courses/:id?payment=success",
  "errorUrl": "https://app/courses/:id?payment=error",
  "cancelUrl": "https://app/courses/:id?payment=cancel"
}
```

Backend tra ve:

```json
{
  "checkout_url": "https://pay.sepay.vn/...",
  "order_id": "ORDER-123"
}
```

Frontend redirect user den `checkout_url`.

### 4.2 Backend IPN -> Firestore

Backend tao endpoint IPN (theo SePay docs), nhan su kien `ORDER_PAID`, sau do:

1. Xac minh don hang.
2. Ghi ket qua thanh toan vao `payment_transactions`.
3. Cap quyen hoc vao `course_payment_access`.

De xuat collection:

- `payment_transactions/{order_id}`
  - `user_id`
  - `course_id`
  - `purpose`: `course_purchase` | `certificate_fee`
  - `amount_vnd`
  - `provider`: `sepay`
  - `status`: `pending` | `paid` | `failed` | `cancelled`
  - `provider_payload`
  - `created_at`, `updated_at`

- `course_payment_access/{userId}_{courseId}`
  - `user_id`
  - `course_id`
  - `full_access_granted` (bool)
  - `certificate_fee_paid` (bool)
  - `updated_at`

Rule cap quyen:

- `purpose = course_purchase` -> `full_access_granted = true`
- `purpose = certificate_fee` -> `certificate_fee_paid = true`

## 5. UI/UX y nghia

- `paid_upfront`: neu chua co `full_access_granted` thi khoa noi dung full.
- `free_with_paid_certificate`: hoc full mien phi, nhung chi nop bai/cuoi khoa khi da `certificate_fee_paid = true`.
- Trang quan ly khoa hoc (instructor/admin/hoc vu) hien ro:
  - loai so huu khoa hoc
  - ty le chia doanh thu
  - danh sach tai lieu hop dong/hoa don

