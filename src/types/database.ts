/**
 * Database types — User roles & profiles
 * Roles: học viên (student), giảng viên (instructor), chăm sóc viên (support_staff), admin
 */

import i18n from "@/i18n";

export type UserRole = "student" | "instructor" | "support_staff" | "admin";
export type Locale = "vi" | "en";

export type InstructorSocialPlatform =
  | "twitter"
  | "linkedin"
  | "github"
  | "youtube"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "website"
  | "other";

export interface InstructorSocialLink {
  platform: InstructorSocialPlatform;
  url: string;
  label?: string | null;
}

export interface PartnerProfileDocument {
  name: string;
  url: string;
  path: string;
  uploaded_at: string;
  uploaded_by: string;
  /** Dùng cho hoá đơn/đối soát: YYYY-MM */
  invoice_month?: string | null;
  /** Ghi chú tuỳ chọn (số HĐ, kỳ thanh toán, v.v.) */
  note?: string | null;
}

export interface Profile {
  id: string;
  role: UserRole;
  /** Public handle (GitHub-like), unique (case-insensitive) */
  username?: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  /** Email đăng nhập (từ Supabase Auth), lưu khi tạo profile */
  email: string | null;
  /** Public bio (GitHub-like) */
  bio?: string | null;
  /** Public website/portfolio link */
  website?: string | null;
  /** Whether profile is visible publicly */
  profile_public?: boolean;
  follower_count?: number;
  following_count?: number;
  /** Ngôn ngữ UI người dùng chọn (vd: vi/en) */
  locale?: Locale | null;
  /** Open Campus ID (OCID) đã liên kết (nếu có) */
  ocid?: string | null;
  /** Ethereum address liên kết với OCID (nếu có) */
  ocid_eth_address?: string | null;
  /** Thời điểm liên kết OCID (ISO string) */
  ocid_connected_at?: string | null;
  /** Set bởi private.handle_new_user() khi ghost-mint credential được claim lúc đăng ký (ISO string) */
  pending_credentials_claimed_at?: string | null;
  /** Loại giảng viên: nội bộ Corelia hay đối tác bên ngoài (chỉ dùng khi role = instructor) */
  instructor_origin?: "corelia" | "external";
  /** Tiêu đề ngắn hiển thị dưới tên giảng viên (ví dụ: Senior Frontend Engineer, Data Analyst) */
  instructor_headline?: string | null;
  /** Mô tả giới thiệu chi tiết cho hồ sơ giảng viên */
  instructor_bio?: string | null;
  /** Đơn vị công tác chính (Corelia, công ty khác, trường đại học, v.v.) */
  instructor_organization?: string | null;
  /** Link website cá nhân / LinkedIn / portfolio (nếu có) */
  instructor_website?: string | null;
  /** Danh sách link mạng xã hội của giảng viên */
  instructor_social_links?: InstructorSocialLink[] | null;
  /** Hồ sơ hợp đồng đối tác ở cấp giảng viên (không phụ thuộc khoá học) */
  partner_contract_docs?: PartnerProfileDocument[];
  /** Hồ sơ hoá đơn đối tác ở cấp giảng viên */
  partner_invoice_docs?: PartnerProfileDocument[];
  /** Thông tin thanh toán/chuyển khoản ở cấp giảng viên */
  partner_transfer_info?: string | null;
  /** Thông tin ngân hàng (tách trường để rõ ràng hơn) */
  partner_bank_name?: string | null;
  partner_bank_account_number?: string | null;
  partner_bank_account_holder?: string | null;
  partner_bank_transfer_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  role?: UserRole;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  website?: string | null;
  profile_public?: boolean;
  follower_count?: number;
  following_count?: number;
  locale?: Locale | null;
  ocid?: string | null;
  ocid_eth_address?: string | null;
  ocid_connected_at?: string | null;
  instructor_origin?: "corelia" | "external";
  instructor_headline?: string | null;
  instructor_bio?: string | null;
  instructor_organization?: string | null;
  instructor_website?: string | null;
  instructor_social_links?: InstructorSocialLink[] | null;
  partner_contract_docs?: PartnerProfileDocument[];
  partner_invoice_docs?: PartnerProfileDocument[];
  partner_transfer_info?: string | null;
  partner_bank_name?: string | null;
  partner_bank_account_number?: string | null;
  partner_bank_account_holder?: string | null;
  partner_bank_transfer_note?: string | null;
}

export interface ProfileUpdate {
  role?: UserRole;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  website?: string | null;
  profile_public?: boolean;
  follower_count?: number;
  following_count?: number;
  locale?: Locale | null;
  ocid?: string | null;
  ocid_eth_address?: string | null;
  ocid_connected_at?: string | null;
  instructor_origin?: "corelia" | "external";
  instructor_headline?: string | null;
  instructor_bio?: string | null;
  instructor_organization?: string | null;
  instructor_website?: string | null;
  instructor_social_links?: InstructorSocialLink[] | null;
  partner_contract_docs?: PartnerProfileDocument[];
  partner_invoice_docs?: PartnerProfileDocument[];
  partner_transfer_info?: string | null;
  partner_bank_name?: string | null;
  partner_bank_account_number?: string | null;
  partner_bank_account_holder?: string | null;
  partner_bank_transfer_note?: string | null;
}

export function getRoleLabel(role: UserRole): string {
  return i18n.t(`auth:roles.${role}`, { defaultValue: role });
}

export function isStudent(role: UserRole): boolean {
  return role === "student";
}

export function isInstructor(role: UserRole): boolean {
  return role === "instructor";
}

export function isSupportStaff(role: UserRole): boolean {
  return role === "support_staff";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/** Kiểm tra role có nằm trong danh sách cho phép không. Admin được coi là có cả quyền instructor. */
export function hasRole(role: UserRole, allowed: readonly UserRole[]): boolean {
  if (allowed.includes(role)) return true;
  if (role === "admin" && allowed.includes("instructor")) return true;
  return false;
}

export interface PublicProfile {
  id: string;
  username: string | null;
  ocid: string | null;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  instructor_origin: Profile["instructor_origin"] | null;
  instructor_headline: string | null;
  instructor_bio: string | null;
  instructor_organization: string | null;
  instructor_website: string | null;
  instructor_social_links: InstructorSocialLink[] | null;
  profile_public: boolean;
  follower_count?: number;
  following_count?: number;
  created_at: string;
  updated_at: string;
}
