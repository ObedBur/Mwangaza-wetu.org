import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public, Private } from './jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { ChangeMemberPasswordDto } from './dto/change-member-password.dto';

@Public()
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.loginUnified(loginDto);
  }

  @Post('admin/login')
  async loginAdmin(@Body() loginDto: LoginDto) {
    return this.authService.loginAdmin(loginDto);
  }

  @Post('member/login')
  async loginMember(@Body() loginDto: LoginDto) {
    return this.authService.loginMember(loginDto);
  }

  @Post('agent/login')
  async loginAgent(@Body() loginDto: LoginDto) {
    return this.authService.loginAgent(loginDto);
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
      req.user!, dto.currentPassword, dto.newPassword,
    );
  }
}
