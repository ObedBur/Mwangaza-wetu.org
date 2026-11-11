import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public, Private } from './jwt-auth.guard';
import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { ChangeMemberPasswordDto } from './dto/change-member-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginThrottleGuard } from './login-throttle.guard';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME, readRequestCookie } from './auth-cookies';

@Public()
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottleGuard: LoginThrottleGuard,
  ) {}

  @Post('login')
  @UseGuards(LoginThrottleGuard)
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginUnified(loginDto);
    await this.loginThrottleGuard.resetIdentifier(request);
    return this.createSession(response, result, loginDto.rememberMe !== false);
  }

  @Post('admin/login')
  @UseGuards(LoginThrottleGuard)
  async loginAdmin(@Body() loginDto: LoginDto, @Req() request: ExpressRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginAdmin(loginDto);
    await this.loginThrottleGuard.resetIdentifier(request);
    return this.createSession(response, result, loginDto.rememberMe !== false);
  }

  @Post('member/login')
  @UseGuards(LoginThrottleGuard)
  async loginMember(@Body() loginDto: LoginDto, @Req() request: ExpressRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginMember(loginDto);
    await this.loginThrottleGuard.resetIdentifier(request);
    return this.createSession(response, result, loginDto.rememberMe !== false);
  }

  @Post('agent/login')
  @UseGuards(LoginThrottleGuard)
  async loginAgent(@Body() loginDto: LoginDto, @Req() request: ExpressRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginAgent(loginDto);
    await this.loginThrottleGuard.resetIdentifier(request);
    return this.createSession(response, result, loginDto.rememberMe !== false);
  }

  @Public()
  @Get('csrf-token')
  getCsrfToken(@Req() request: ExpressRequest, @Res({ passthrough: true }) response: Response) {
    const csrfToken = readRequestCookie(request, CSRF_COOKIE_NAME);
    if (!csrfToken) {
      // Génère un nouveau token si aucun n'existe encore
      const newToken = randomBytes(32).toString('hex');
      const secure = process.env.NODE_ENV === 'production';
      response.cookie(CSRF_COOKIE_NAME, newToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
      });
      return { csrfToken: newToken };
    }
    return { csrfToken };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    const secure = process.env.NODE_ENV === 'production';
    response.clearCookie(SESSION_COOKIE_NAME, { path: '/', httpOnly: true, secure, sameSite: 'lax' });
    response.clearCookie(CSRF_COOKIE_NAME, { path: '/', secure, sameSite: 'lax' });
    return { success: true };
  }

  @Private()
  @Roles('admin', 'superadmin', 'member', 'agent')
  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    return {
      success: true,
      user: await this.authService.getProfile(req.user!),
    };
  }

  @Private()
  @Roles('member')
  @Post('me/mot-de-passe')
  async changeMemberPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangeMemberPasswordDto,
  ) {
    return this.authService.changeMemberPassword(
      req.user!,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Private()
  @Roles(...ADMIN_ROLES)
  @Post('me/change-password')
  async changeAdminPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changeAdminPassword(
      req.user!,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  private createSession(
    response: Response,
    result: { success: boolean; message: string; token: string; user: object },
    rememberMe: boolean,
  ) {
    const secure = process.env.NODE_ENV === 'production';
    const persistentOptions = rememberMe ? { maxAge: 24 * 60 * 60 * 1000 } : {};
    response.cookie(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      ...persistentOptions,
    });
    const csrfToken = randomBytes(32).toString('hex');
    response.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: true, // ← JS ne peut plus le lire : protection contre le vol par XSS
      secure,
      sameSite: 'lax',
      path: '/',
      ...persistentOptions,
    });
    const { token: _token, ...publicResult } = result;
    // On retourne le token dans le corps de la réponse pour que le frontend puisse l'envoyer en header X-CSRF-Token
    return { ...publicResult, csrfToken };
  }
}
