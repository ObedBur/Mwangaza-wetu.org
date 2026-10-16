import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/auth-request';

const OWN_ONLY_MESSAGE =
  'Accès refusé : vous ne pouvez consulter que votre propre compte';

/**
 * Ownership guard for account-number based routes.
 * Members may only access their own numeroCompte (from JWT);
 * admin/superadmin/agent callers are unrestricted.
 */
export function assertOwnAccountOrAdmin(
  req: AuthenticatedRequest,
  numero: string,
): void {
  if (
    req.user?.role === 'member' &&
    String(req.user.accountNumber) !== String(numero)
  ) {
    throw new ForbiddenException(OWN_ONLY_MESSAGE);
  }
}

/**
 * Ownership guard for numeric id based routes (member resource).
 * Members may only access their own id (from JWT).
 */
export function assertOwnIdOrAdmin(
  req: AuthenticatedRequest,
  id: number,
): void {
  if (req.user?.role === 'member' && String(req.user.userId) !== String(id)) {
    throw new ForbiddenException(OWN_ONLY_MESSAGE);
  }
}
