import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (import.meta.env.DEV && !firebaseConfig.apiKey) {
  console.warn(
    "[Firebase] VITE_FIREBASE_API_KEY trống. Firestore có thể trả 403. Xem docs/FIREBASE_403_TROUBLESHOOTING.md"
  );
}

export const app = initializeApp(firebaseConfig);

// App Check với reCAPTCHA v3 – giúp chống lạm dụng/DoS trên Auth và các dịch vụ Firebase.
// Cần đăng ký reCAPTCHA v3, lấy site key và cấu hình trong Firebase Console → App Check.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
let _appCheck: AppCheck | null = null;
if (recaptchaSiteKey) {
  _appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.PROD) {
  // Trên production, App Check bị tắt do thiếu key → Firebase services không được bảo vệ.
  console.error(
    "[Firebase] VITE_RECAPTCHA_V3_SITE_KEY chưa được cấu hình. " +
    "App Check bị tắt — Firestore và Auth có thể bị lạm dụng. " +
    "Thêm key vào biến môi trường production."
  );
}

/**
 * Lấy App Check token hiện tại để đính kèm vào request đến Cloud Functions.
 * Trả về null nếu App Check chưa được khởi tạo (dev không có key).
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!_appCheck) return null;
  try {
    const { token } = await getToken(_appCheck);
    return token;
  } catch {
    return null;
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
