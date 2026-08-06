// =============================================================================
// src/app/core/models/admin.models.ts
// Phase 14 - Admin Console.
//
// Mirrors AcmsDashboard.Api/Dtos/AdminDtos.cs exactly. If you change a field
// name on one side, change it here too - there is no codegen keeping these in
// sync, which is exactly why they live in one small file rather than being
// scattered inline across components.
// =============================================================================

/** The four roles seeded in Phase 3. */
export type AcmsRole = 'Admin' | 'Security' | 'Printer' | 'Viewer';

export const ACMS_ROLES: readonly AcmsRole[] = ['Admin', 'Security', 'Printer', 'Viewer'] as const;

/** Row in the admin user table. Maps to UserListDto. */
export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  role: AcmsRole | '-';
  isActive: boolean;
}

/** Single-user detail. Maps to UserDetailDto. */
export interface AdminUserDetail extends AdminUser {
  lockoutEnabled: boolean;
  lockoutEnd: string | null;
  accessFailedCount: number;
}

/** Maps to AdminStatsDto. */
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  byRole: Record<string, number>;
}

// --- Request payloads --------------------------------------------------------

export interface CreateUserPayload {
  username: string;
  email: string | null;
  password: string;
  role: AcmsRole;
}

export interface UpdateUserPayload {
  email: string | null;
}

// --- Presentation helpers ----------------------------------------------------

/**
 * Role -> visual tone. Kept here rather than in the component so the users
 * table, the role filter and any future admin surface all agree.
 */
export const ROLE_TONE: Record<string, 'violet' | 'blue' | 'cyan' | 'rose' | 'muted'> = {
  Admin: 'rose',
  Security: 'violet',
  Printer: 'blue',
  Viewer: 'cyan',
  '-': 'muted',
};

/** Plain-English description shown under each role in the create/edit form. */
export const ROLE_DESCRIPTION: Record<AcmsRole, string> = {
  Admin: 'Full access. Manages users, roles and all data.',
  Security: 'Verifies submitted card requests. Cannot print or manage users.',
  Printer: 'Marks verified requests as printed. Cannot verify.',
  Viewer: 'Read-only dashboard and NL agent access. No write actions.',
};