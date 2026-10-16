import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles allowed to access a route.
 * When omitted, the RolesGuard defaults to admin-only (secure by default).
 *
 * Usage: @Roles('admin', 'superadmin') or @Roles('admin', 'superadmin', 'member')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Backend admin roles (Prisma enum Role) */
export const ADMIN_ROLES = ['admin', 'superadmin'] as const;

/**
 * Superadmin-only roles: destructive / hierarchy operations
 * (create-or-delete admins, delete members, financial records, rate changes).
 */
export const SUPERADMIN_ROLES = ['superadmin'] as const;
