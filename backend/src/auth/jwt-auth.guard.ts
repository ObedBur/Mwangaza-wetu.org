import { ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME, readRequestCookie } from './auth-cookies';

// Custom decorator to make a route public
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
/** Overrides a class-level @Public: the route then requires a valid JWT */
export const Private = () => SetMetadata(IS_PUBLIC_KEY, false);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const hasSessionCookie = Boolean(readRequestCookie(request, SESSION_COOKIE_NAME));
    if (hasSessionCookie && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const cookieToken = readRequestCookie(request, CSRF_COOKIE_NAME);
      const headerToken = request.get('x-csrf-token');
      const cookieBuffer = Buffer.from(cookieToken ?? '');
      const headerBuffer = Buffer.from(headerToken ?? '');
      if (
        cookieBuffer.length === 0 ||
        cookieBuffer.length !== headerBuffer.length ||
        !timingSafeEqual(cookieBuffer, headerBuffer)
      ) {
        throw new ForbiddenException('Jeton CSRF absent ou invalide');
      }
    }

    return super.canActivate(context);
  }
}
