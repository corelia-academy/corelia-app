# Code Review: Supabase Migration — Corelia App

> **Branch:** `develop`  
> **Review date:** 2026-05-04  
> **Scope:** Toàn bộ codebase sau khi migrate Firebase → Supabase

---

## Tóm tắt

Migration cơ bản đã hoàn chỉnh — Firebase đã được thay bằng Supabase client, auth, storage và Edge Functions. Còn lại **4 bugs thực**, **1 vấn đề security nhỏ**, và **nhiều dead code / stale comment** cần dọn dẹp.

---

## 🔴 CRITICAL — Cần sửa trước khi ship

### 1. `.env.example` không có Supabase vars — setup sẽ fail silently

**File:** `.env.example`

**Vấn đề:** File này vẫn chỉ liệt kê Firebase vars. Nhưng code thực tế ở `src/lib/supabase.ts` và `src/lib/coreliaEdgeApi.ts` cần `VITE_SUPABASE_URL` và một trong hai key công khai: `VITE_SUPABASE_PUBLISHABLE_KEY` (khuyến nghị) hoặc `VITE_SUPABASE_ANON_KEY` (legacy). Bất kỳ developer nào setup từ file này sẽ bị lỗi — Supabase client khởi tạo với chuỗi rỗng, mọi query đều fail nhưng không có thông báo rõ ràng ở production.

**Hiện tại:**
```
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""

# Tuỳ chọn: Open Campus ID (OCID) Connect
VITE_OCID_CLIENT_ID=""
VITE_OCID_REDIRECT_URI="https://<your-prod-domain>/ocid-redirect"

# Tuỳ chọn: backend checkout endpoint (nếu KHÔNG dùng Firebase Hosting rewrite /api/**)
# VITE_SEPAY_CHECKOUT_API="https://<your-prod-domain>/api/payments/sepay/checkout"
# VITE_SEPAY_VERIFY_API="https://<your-prod-domain>/api/payments/sepay/verify"
# VITE_SEPAY_TRANSACTIONS_API="https://<your-prod-domain>/api/payments/transactions"

# Tuỳ chọn: lấy thời lượng video từ YouTube khi thêm bài học
# VITE_YOUTUBE_API_KEY=""

```

**Fix — Thay toàn bộ nội dung `.env.example` thành:**
```
# Supabase (bắt buộc)
# Lấy từ Supabase Dashboard → Connect / API
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-publishable-key>"
# hoặc: VITE_SUPABASE_ANON_KEY="<your-anon-public-key>"

# Tuỳ chọn: override URL của Supabase Edge Functions (mặc định tự suy từ VITE_SUPABASE_URL)
# VITE_CORELIA_FUNCTIONS_URL="https://<your-project-ref>.supabase.co/functions/v1/corelia-api"

# Tuỳ chọn: Open Campus ID (OCID) Connect
VITE_OCID_CLIENT_ID=""
VITE_OCID_REDIRECT_URI="https://<your-prod-domain>/ocid-redirect"

# Tuỳ chọn: override endpoint thanh toán (nếu không dùng Supabase Edge Functions)
# VITE_SEPAY_CHECKOUT_API="https://<your-prod-domain>/api/payments/sepay/checkout"
# VITE_SEPAY_VERIFY_API="https://<your-prod-domain>/api/payments/sepay/verify"
# VITE_SEPAY_TRANSACTIONS_API="https://<your-prod-domain>/api/payments/transactions"

# Tuỳ chọn: lấy thời lượng video từ YouTube khi thêm bài học
# VITE_YOUTUBE_API_KEY=""

```

---

### 2. Race condition trong `AuthSync` — profile cũ ghi đè state sau khi logout

**File:** `src/components/auth/AuthSync.tsx` — toàn bộ `useEffect`

**Vấn đề:** `mounted` flag chỉ bảo vệ khi component unmount, **không ngăn** race giữa nhiều auth events liên tiếp. Scenario xảy ra:

1. User login → `onAuthStateChange` event #1 → `getCurrentProfile()` bắt đầu fetch (2–3 giây)
2. User logout ngay sau đó → `onAuthStateChange` event #2 → `setUser(null)`, `setProfile(null)` ✓
3. **`getCurrentProfile()` từ event #1 resolve** → `setProfile(oldProfile)` ← **BUG: profile cũ ghi đè null**
4. State cuối: `user = null` nhưng `profile = <profile của user cũ>` → logic auth sai

**Hiện tại:**
```tsx
useEffect(() => {
  let mounted = true;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!mounted) return;
    const user = session?.user ?? null;
    setUser(user);
    setAuthInitialized(true);

    if (user) {
      setLoading(true);
      try {
        const p = await getCurrentProfile(); // không có cơ chế cancel
        if (mounted) {
          setProfile(p);
          // ...
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    } else {
      setProfile(null);
      setLoading(false);
      // ...
    }
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, [setUser, setProfile, setLoading, setAuthInitialized]);
```

**Fix — Dùng sequence counter để discard kết quả stale:**
```tsx
useEffect(() => {
  let mounted = true;
  let currentSeq = 0; // tăng mỗi lần auth event mới đến

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!mounted) return;

    const seq = ++currentSeq; // capture seq tại thời điểm event này
    const user = session?.user ?? null;
    setUser(user);
    setAuthInitialized(true);

    if (user) {
      setLoading(true);
      try {
        const p = await getCurrentProfile();
        // Chỉ apply nếu đây vẫn là auth event mới nhất
        if (mounted && seq === currentSeq) {
          setProfile(p);
          const locale = (p?.locale ?? DEFAULT_LANGUAGE) as SupportedLanguage;
          void i18n.changeLanguage(locale);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        if (mounted && seq === currentSeq) setProfile(null);
      } finally {
        if (mounted && seq === currentSeq) setLoading(false);
      }
    } else {
      setProfile(null);
      setLoading(false);
      try {
        localStorage.removeItem("i18nextLng");
      } catch {
        // ignore
      }
      const langs =
        (typeof navigator !== "undefined" && Array.isArray(navigator.languages)
          ? navigator.languages
          : typeof navigator !== "undefined" && navigator.language
            ? [navigator.language]
            : []) ?? [];
      const isVi = langs.some((l) => String(l).toLowerCase().startsWith("vi"));
      const publicLocale: SupportedLanguage = isVi ? "vi" : "en";
      void i18n.changeLanguage(publicLocale);
    }
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, [setUser, setProfile, setLoading, setAuthInitialized]);
```

---

### 3. `getAccessToken()` nuốt lỗi — payment request gửi không có token

**File:** `src/lib/payments.ts` — lines 70–91

**Vấn đề:** Nếu `supabase.auth.getSession()` throw (mạng lỗi, session corrupt...), `.catch(() => null)` ở line 82 trả về `null`. Request thanh toán vẫn được gửi đi nhưng **không có Authorization header** — Edge Function sẽ xử lý như anonymous user, trả 401/403, nhưng error message hiện ra là chung chung "Không tạo được phiên thanh toán" thay vì "Hãy đăng nhập lại".

**Hiện tại:**
```ts
// line 70-73
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// line 82
const token = await getAccessToken().catch(() => null); // nuốt lỗi
const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...supabaseFunctionHeaders(token), // token có thể null
  },
  // ...
});
```

**Fix — Fail fast nếu chưa login, log rõ nếu session lỗi:**
```ts
async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (err) {
    console.error("[payments] getSession failed:", err);
    return null;
  }
}

export async function createSePayCheckout(
  payload: CreateSePayCheckoutInput,
): Promise<CreateSePayCheckoutResponse> {
  const endpoint =
    import.meta.env.VITE_SEPAY_CHECKOUT_API ||
    coreliaEdgeUrl("payments.sepay.checkout");

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  // ... phần còn lại giữ nguyên
```

**Áp dụng tương tự cho `getMyPaymentTransactions()` (line ~118) và `verifySePayPayment()` (line ~140).**

---

### 4. `refreshProfile()` không có error handling — crash im lặng

**File:** `src/stores/authStore.ts` — lines 40–43

**Vấn đề:** Nếu `getCurrentProfile()` throw, exception sẽ bubble ra ngoài `refreshProfile()` mà không bị xử lý. Component gọi `refreshProfile()` phải tự catch, nhưng nhiều nơi gọi dạng `void refreshProfile()` — lỗi sẽ thành unhandled rejection.

**Hiện tại:**
```ts
refreshProfile: async () => {
  const profile = await getCurrentProfile(); // có thể throw
  set({ profile });
},
```

**Fix:**
```ts
refreshProfile: async () => {
  try {
    const profile = await getCurrentProfile();
    set({ profile });
  } catch (err) {
    console.error("[authStore] refreshProfile failed:", err);
    // không reset profile — giữ dữ liệu cũ còn hơn xóa trắng
  }
},
```

---

## 🟡 QUALITY — Nên sửa

### 5. `waitForSupabaseUser` timeout 10s quá ngắn cho mobile / OAuth flow

**File:** `src/pages/CheckoutSuccess.tsx` — line 70

**Vấn đề:** Sau OAuth redirect (Google login), Supabase cần parse hash fragment và restore session. Trên mạng chậm hoặc khi browser tab từng bị suspend, 10 giây với interval 120ms là không đủ. User sẽ thấy lỗi "session not ready" dù thực ra đang login.

**Hiện tại:**
```ts
// line 70
const hasUser = await waitForSupabaseUser(10_000);
```

**Fix — Tăng timeout và dùng exponential backoff:**
```ts
async function waitForSupabaseUser(maxMs: number): Promise<boolean> {
  const started = Date.now();
  let interval = 100;
  while (Date.now() - started < maxMs) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return true;
    await new Promise((r) => window.setTimeout(r, interval));
    interval = Math.min(500, interval + 50); // backoff: 100 → 150 → ... → 500ms
  }
  return false;
}

// Tăng từ 10s lên 30s
const hasUser = await waitForSupabaseUser(30_000);
```

---

## 🧹 DEAD CODE — Dọn dẹp

### 6. Firebase leftovers ở root repo — có thể xóa an toàn

Những file này không còn được dùng sau khi migrate sang Supabase + Cloudflare Workers:

| File/Folder | Lý do xóa |
|-------------|-----------|
| `firebase.json` | Firebase Hosting/Functions config |
| `firestore.rules` | Thay bằng Supabase RLS policies |
| `storage.rules` | Thay bằng Supabase Storage policies |
| `firestore.indexes.json` | Firestore-specific, không dùng PostgreSQL |
| `.firebaserc` | Firebase project config |
| `functions/` | Firebase Cloud Functions — đã migrate sang `supabase/functions/` |

**Cách xóa:**
```bash
rm -rf firebase.json firestore.rules storage.rules firestore.indexes.json .firebaserc functions/
```

> ⚠️ Trước khi xóa `functions/` — xác nhận tất cả logic trong đó đã được port sang `supabase/functions/corelia-api/`.

---

### 7. Deploy scripts trong `package.json` vẫn trỏ Firebase CLI

**File:** `package.json`

**Vấn đề:** Các script `deploy:dev`, `deploy:staging`, `deploy:prod`, `deploy:functions:*`, `deploy:hosting:*` đều gọi `firebase use ... && firebase deploy`. Nếu developer chạy nhầm sẽ deploy lên Firebase project cũ.

**Hiện tại:**
```json
"deploy:dev": "pnpm build:dev && firebase use dev && firebase deploy",
"deploy:staging": "pnpm build:staging && firebase use staging && firebase deploy",
"deploy:prod": "pnpm build:prod && firebase use prod && firebase deploy",
"deploy:functions:dev": "firebase use dev && firebase deploy --only functions",
"deploy:functions:staging": "firebase use staging && firebase deploy --only functions",
"deploy:functions:prod": "firebase use prod && firebase deploy --only functions",
"deploy:hosting:dev": "pnpm build:dev && firebase use dev && firebase deploy --only hosting",
"deploy:hosting:staging": "pnpm build:staging && firebase use staging && firebase deploy --only hosting",
"deploy:hosting:prod": "pnpm build:prod && firebase use prod && firebase deploy --only hosting",
```

**Fix — Xóa các script Firebase và giữ lại script Wrangler/Supabase:**
```json
"deploy": "pnpm run build && wrangler deploy",
"functions:deploy": "supabase functions deploy corelia-api",
"functions:serve": "supabase functions serve corelia-api --no-verify-jwt"
```

---

### 8. Stale comments vẫn nhắc đến Firebase

**Files cần sửa:**

**`src/types/database.ts` — line 2:**
```ts
// Trước:
// Database types (chuyển sang Firebase/Firestore) – User roles & profiles

// Sau: xóa dòng comment này
```

**`src/types/database.ts` — line 29:**
```ts
// Trước:
/** Email đăng nhập (từ Firebase Auth), lưu khi tạo profile */

// Sau:
/** Email đăng nhập (từ Supabase Auth), lưu khi tạo profile */
```

**`src/types/courses.ts` — line 109:**
```ts
// Trước:
/** Đường dẫn gốc trong Firebase Storage (course-thumbnails/...), dùng để xoá ảnh cũ khi thay */

// Sau:
/** Đường dẫn trong Supabase Storage (course-thumbnails/...), dùng để xoá ảnh cũ khi thay */
```

**`src/types/contests.ts` — line 86:**
```ts
// Trước:
/** Firebase Storage path for banner — used when replacing/deleting */

// Sau:
/** Storage path for banner — used when replacing/deleting */
```

---

### 9. `loginErrors.ts` còn code path Firebase không bao giờ trigger

**File:** `src/pages/login/loginErrors.ts` — lines 12–21 và 61–76

**Vấn đề:** Hàm `isFirebaseAuthError()` (check `{ code: string }`) và branch xử lý nó ở `getAuthErrorInfo()` là dead code — Supabase Auth không throw object có `code` field theo format Firebase (`auth/invalid-credential`, v.v.). Supabase throw `AuthError` với `__isAuthError: true` và `message` string.

Branch Firebase chỉ có thể trigger nếu ai đó throw manually một object `{ code: "auth/..." }`, không phải từ SDK.

**Fix — Giữ lại logic Supabase, xóa Firebase branch:**

```ts
// Xóa hàm isFirebaseAuthError() (lines 12-21)

// Trong getAuthErrorInfo(), xóa block if (isFirebaseAuthError(...)) { ... } (lines 61-76)
// Giữ lại: isSupabaseAuthError block, err instanceof Error, typeof err === "string"
```

**Kết quả sau fix:**
```ts
export function getAuthErrorInfo(err: unknown, translate?: Translate): AuthErrorInfo {
  if (isSupabaseAuthError(err)) {
    const code = supabaseAuthToPseudoCode(err);
    const codeKey = `errors.${authCodeKey(code)}`;
    const translated = translate ? translate(codeKey, { defaultValue: "" }) : "";
    return {
      code,
      message: translated || err.message || (translate ? translate("errors.generic", { defaultValue: "" }) : "Something went wrong."),
    };
  }
  if (err instanceof Error) return { message: err.message };
  if (typeof err === "string") return { message: err };
  return {
    message: translate ? translate("errors.generic", { defaultValue: "" }) : "Something went wrong.",
  };
}
```

---

## ✅ Những thứ đã làm đúng — không cần sửa

- **`authStore.ts` không persist `user`** — Đúng. Supabase SDK tự manage session trong localStorage (`sb-*-auth-token`). `onAuthStateChange` sẽ restore `user` khi load lại trang. Persist `user` vào Zustand là thừa và có thể gây stale data.

- **`supabase.ts` config** — `persistSession: true, autoRefreshToken: true, detectSessionInUrl: true` là đúng cho app SPA.

- **`ChangePasswordCard.tsx`** — Flow `signInWithPassword` (verify mật khẩu cũ) → `updateUser` (đổi mật khẩu mới) là đúng với Supabase. Nếu `signInWithPassword` fail, `updateUser` không bao giờ chạy.

- **`coreliaEdgeApi.ts`** — Logic tự suy Supabase Functions URL từ `VITE_SUPABASE_URL` là pattern tốt, không hardcode.

- **`profile.ts` — `rowToProfile()`** — Cách explicit map từng field tốt hơn `as Profile` unsafe cast.

---

## Checklist tổng hợp

| # | Việc cần làm | File | Mức độ |
|---|-------------|------|--------|
| 1 | Rewrite `.env.example` với Supabase vars | `.env.example` | 🔴 Critical |
| 2 | Fix race condition với sequence counter | `src/components/auth/AuthSync.tsx` | 🔴 Critical |
| 3 | Fail fast trong `createSePayCheckout` khi không có token | `src/lib/payments.ts` | 🔴 Critical |
| 4 | Add try/catch cho `refreshProfile` | `src/stores/authStore.ts` | 🔴 Critical |
| 5 | Tăng timeout `waitForSupabaseUser` lên 30s + backoff | `src/pages/CheckoutSuccess.tsx` | 🟡 Quality |
| 6 | Xóa Firebase config files và `functions/` folder | root | 🧹 Cleanup |
| 7 | Xóa Firebase deploy scripts trong `package.json` | `package.json` | 🧹 Cleanup |
| 8 | Cập nhật stale comments | `src/types/database.ts`, `courses.ts`, `contests.ts` | 🧹 Cleanup |
| 9 | Xóa dead code Firebase trong `loginErrors.ts` | `src/pages/login/loginErrors.ts` | 🧹 Cleanup |
