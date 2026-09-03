import type { UserRole } from "../types/database";

export const ROLE_GROUPS = {
  /** Admin and support staff. */
  admin: ["admin", "support_staff"] as UserRole[],
  /** Full hackathon managers for catalog, workspace, and service mutations. */
  contestManagers: ["support_staff", "admin"] as UserRole[],
  /** Instructor workspace access. */
  instructorWorkspace: ["instructor", "support_staff", "admin"] as UserRole[],
} as const;
