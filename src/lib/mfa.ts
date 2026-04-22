/**
 * Multi-factor authentication (MFA) – SMS second factor.
 * Cần bật "SMS Multi-factor Authentication" trong Firebase Console → Authentication → Sign-in method → Advanced.
 * Tài liệu: https://firebase.google.com/docs/auth/web/multi-factor
 */
import {
  type MultiFactorResolver,
  type Auth,
  type User,
  multiFactor,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from "firebase/auth";

export type { MultiFactorResolver };

const FACTOR_ID_PHONE = "phone";

/** Kiểm tra hint có phải SMS (phone) không */
export function isPhoneFactorHint(
  hint: MultiFactorResolver["hints"][number],
): boolean {
  return hint.factorId === FACTOR_ID_PHONE;
}

/** Kiểm tra user đã đăng ký ít nhất một second factor chưa */
export function hasEnrolledFactors(user: User): boolean {
  try {
    const factors = multiFactor(user).enrolledFactors;
    return factors.length > 0;
  } catch {
    return false;
  }
}

/** Lấy danh sách second factor đã đăng ký (displayName hoặc masked info) */
export function getEnrolledFactorsDisplay(user: User): string[] {
  try {
    const factors = multiFactor(user).enrolledFactors;
    return factors.map((f) => {
      if (f.factorId === FACTOR_ID_PHONE && "phoneNumber" in f) {
        return (f as { phoneNumber?: string }).phoneNumber ?? "SMS";
      }
      return f.displayName ?? f.factorId;
    });
  } catch {
    return [];
  }
}

/**
 * Tạo RecaptchaVerifier cho luồng SMS (đăng ký hoặc đăng nhập MFA).
 * Dùng invisible để gắn vào nút (elementId = id của nút bấm "Gửi mã").
 */
export function createRecaptchaVerifier(
  authInstance: Auth,
  elementId: string,
  options?: {
    size?: "normal" | "compact" | "invisible";
    callback?: (response: string) => void;
    "expired-callback"?: () => void;
  },
): RecaptchaVerifier {
  const size = options?.size ?? "invisible";
  return new RecaptchaVerifier(authInstance, elementId, {
    size,
    callback: options?.callback,
    "expired-callback": options?.["expired-callback"],
  });
}

/**
 * Gửi mã SMS cho luồng đăng nhập MFA (khi đã có resolver từ lỗi auth/multi-factor-auth-required).
 * Trả về verificationId để bước sau dùng với mã OTP user nhập.
 */
export async function sendSignInMfaSms(
  authInstance: Auth,
  resolver: MultiFactorResolver,
  selectedHintIndex: number,
  recaptchaVerifier: RecaptchaVerifier,
): Promise<string> {
  const hint = resolver.hints[selectedHintIndex];
  if (!hint || hint.factorId !== FACTOR_ID_PHONE) {
    throw new Error("Chỉ hỗ trợ xác thực bằng SMS.");
  }
  const phoneAuthProvider = new PhoneAuthProvider(authInstance);
  const phoneInfoOptions = {
    multiFactorHint: hint,
    session: resolver.session,
  };
  return phoneAuthProvider.verifyPhoneNumber(
    phoneInfoOptions,
    recaptchaVerifier,
  );
}

/**
 * Hoàn tất đăng nhập MFA sau khi user nhập đúng mã SMS.
 */
export async function resolveSignInWithMfaSms(
  resolver: MultiFactorResolver,
  verificationId: string,
  verificationCode: string,
): Promise<import("firebase/auth").UserCredential> {
  const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
  const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
  return resolver.resolveSignIn(multiFactorAssertion);
}

/**
 * Đăng ký second factor (SMS) cho user đã đăng nhập.
 * Cần re-authenticate trước khi gọi. Trả về verificationId; bước tiếp theo dùng enrollWithVerificationCode.
 */
export async function sendEnrollMfaSms(
  authInstance: Auth,
  user: User,
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier,
): Promise<string> {
  const session = await multiFactor(user).getSession();
  const phoneAuthProvider = new PhoneAuthProvider(authInstance);
  const phoneInfoOptions = {
    phoneNumber,
    session,
  };
  return phoneAuthProvider.verifyPhoneNumber(
    phoneInfoOptions,
    recaptchaVerifier,
  );
}

/**
 * Hoàn tất đăng ký second factor sau khi user nhập đúng mã SMS.
 */
export async function enrollWithVerificationCode(
  user: User,
  verificationId: string,
  verificationCode: string,
  displayName?: string,
): Promise<void> {
  const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
  const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
  await multiFactor(user).enroll(multiFactorAssertion, displayName ?? undefined);
}

/**
 * Lấy MultiFactorResolver từ lỗi auth/multi-factor-auth-required.
 */
export function getMfaResolver(
  authInstance: Auth,
  error: { code: string; [key: string]: unknown },
): MultiFactorResolver | null {
  if (error.code !== "auth/multi-factor-auth-required") return null;
  return getMultiFactorResolver(authInstance, error as unknown as import("firebase/auth").MultiFactorError);
}
