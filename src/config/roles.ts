import type { UserRole } from "@/types/database";

export const ROLE_GROUPS = {
  /** Admin + nhân viên (học vụ/chăm sóc viên) */
  admin: ["admin", "support_staff"] as UserRole[],
  /** Khu vực instructor workspace (giữ nguyên hành vi hiện tại) */
  instructorWorkspace: ["instructor", "support_staff", "admin"] as UserRole[],
} as const;

