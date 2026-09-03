# Architecture and Code Organization

## Dependency direction

Data flow chuẩn là:

```text
route/page → feature UI → query hook/options → domain service → Supabase client
```

Dependency chỉ đi theo chiều này. Domain service không import React, Zustand hoặc presentation component. Presentation component không import Supabase client.

## Trách nhiệm theo lớp

- **Route/page**: compose layout và feature, đọc params/search state, thiết lập route guard; không chứa query implementation dài hoặc transform domain phức tạp.
- **Feature UI**: render props/query result đã chuẩn hóa và phát user intent qua callback.
- **Query layer**: định nghĩa query keys, query options, query/mutation hooks, cache update và invalidation.
- **Domain service**: gọi Supabase/RPC/Edge/Storage, map wire data sang canonical type và chuẩn hóa lỗi.
- **Types**: canonical domain/database shapes dùng chung; không tạo local shape trùng nghĩa.

## Cấu trúc domain

Chỉ tạo file thực sự cần, theo pattern gần nhất:

```text
features/<domain>/
  components/
  hooks/
  queries.ts
  mutations.ts

lib/<domain>.ts       # Supabase/domain service dùng chung
types/<domain>.ts     # canonical types nếu dùng qua nhiều feature
```

Code chỉ dùng trong một page được colocate trong `pages/<feature>/`. Chuyển sang `features/` khi đã có consumer cross-page thật sự.

## Quy định bắt buộc

- Page và presentation component không được gọi `supabase.from`, `rpc`, `storage`, `functions` hoặc `channel` trực tiếp.
- Không fetch server data bằng `useEffect` thông thường. Dùng query hooks; ngoại lệ chỉ dành cho external-system synchronization và phải cleanup.
- Không tạo barrel export rộng nếu làm tăng coupling hoặc phá code splitting.
- Không tạo generic repository/service abstraction bao phủ mọi domain; giữ API theo ngôn ngữ domain.
- Không import private implementation của feature khác. Chuyển phần dùng chung sang public domain boundary trước.
- Route paths, params, search/hash và redirect hiện có phải được giữ nếu task không đổi navigation contract.

## UI là code-defined

Khi thay đổi UI, đọc primitives, shared components, stylesheet và representative implementation của chính feature đó. Reuse trước khi tạo mới, nhưng được sửa primitives hoặc CSS nếu yêu cầu mới chứng minh boundary hiện tại không đủ. Mọi thay đổi vẫn phải giữ keyboard access, focus behavior, responsive layout, i18n và stable loading geometry.
