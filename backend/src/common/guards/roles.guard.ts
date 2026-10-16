import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/jwt-auth.guard';
import { ADMIN_ROLES, ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-based access control.
 *
 * - @Public() routes are skipped (already handled by JwtAuthGuard).
 * - Routes with @Roles(...) require the JWT role to be in the list.
 * - Routes WITHOUT @Roles(...) are admin-only (secure by default):
 *   a member JWT can only reach routes explicitly marked with 'member'.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    const allowedRoles =
      requiredRoles && requiredRoles.length > 0
        ? requiredRoles
        : [...ADMIN_ROLES];

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    const role = request.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        'Accès refusé : vos privilèges ne permettent pas cette opération',
      );
    }

    return true;
  }
}
