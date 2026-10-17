import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Delete,
  Query,
  ParseIntPipe,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { Public } from '../auth/jwt-auth.guard';
import {
  getSectionTrigram,
  normalizeSectionName,
} from '../common/constants/sections';
import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { assertOwnIdOrAdmin } from '../common/utils/ownership';

@Roles(...ADMIN_ROLES)
@Controller('api/membres')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
  ) {
    return this.membersService.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      userId,
    });
  }

  @Get('stats')
  async getStats() {
    return this.membersService.getStats();
  }

  @Get('numeros')
  async getNumeros() {
    const response = await this.membersService.findAll({ pageSize: 1000 });
    return response.data.map((m) => ({
      id: m.id,
      numero_compte: m.numeroCompte,
      nom_complet: m.nomComplet,
    }));
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Get('generate-numero')
  async generateNumero(
    @Query('year') year?: string,
    @Query('section') section?: string,
  ) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const sectionTrigram = section
      ? getSectionTrigram(normalizeSectionName(section))
      : undefined;
    const numero = await this.membersService.generateNumero(y, sectionTrigram);
    return { numero };
  }

  @Get('last-numero')
  async getLastNumero(
    @Query('year') year?: string,
    @Query('section') section?: string,
  ) {
    const sectionTrigram = section
      ? getSectionTrigram(normalizeSectionName(section))
      : undefined;
    const y = year ? parseInt(year) : undefined;
    return this.membersService.getLastNumero(sectionTrigram, y);
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Get('check-userid/:userId')
  async checkUserId(
    @Param('userId') userId: string,
    @Query('exclude') exclude?: string,
  ) {
    const excludeId = exclude ? parseInt(exclude) : undefined;
    return this.membersService.checkUserId(userId, excludeId);
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Get('search')
  async search(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const l = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.membersService.search(search ?? '', l);
  }

  // Membre : uniquement son propre compte (ownership ci-dessous) ;
  // réponse assainie (pas de hash de mot de passe / token d'activation).
  @Roles(...ADMIN_ROLES, 'member')
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    assertOwnIdOrAdmin(req, id);
    const membre = await this.membersService.findOne(id);

    if (req.user?.role === 'member') {
      const safe: Record<string, unknown> = { ...membre };
      delete safe.motDePasse;
      delete safe.activationToken;
      delete safe.activationExpires;
      return safe;
    }
    return membre;
  }

  @Get('by-zkid/:zkId')
  async findByZkId(@Param('zkId') zkId: string) {
    return this.membersService.findByZkId(zkId);
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Get('by-numero/:numero')
  async findByNumero(@Param('numero') numero: string) {
    return this.membersService.findByNumero(numero);
  }

  // Accessible aux membres, mais uniquement pour leurs propres données
  // (ownership vérifié ci-dessous : identifier = id ou numeroCompte du JWT)
  @Roles('member')
  @Get('me/transactions')
  async getOwnTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '50', 10) || 50));
    return this.membersService.getMemberTransactions(
      req.user!.accountNumber!, pageNumber, size,
    );
  }

  @Roles('member')
  @Patch('me/profil')
  async updateOwnProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    return this.membersService.updateOwnProfile(req.user!.userId!, dto);
  }

  @Roles(...ADMIN_ROLES, 'member')
  @Get('dashboard/:identifier')
  async getMemberDashboard(
    @Param('identifier') identifier: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const isMemberCaller = req.user?.role === 'member';

    if (isMemberCaller) {
      const isOwnAccount =
        String(identifier) === String(req.user?.userId) ||
        String(identifier) === String(req.user?.accountNumber);

      if (!isOwnAccount) {
        throw new ForbiddenException(
          'Accès refusé : vous ne pouvez consulter que votre propre compte',
        );
      }
    }

    const result = await this.membersService.getMemberDashboard(identifier);

    return result;
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Post()
  async create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  @Public()
  @Post('activate')
  async activate(@Body() body: { token: string; motDePasse: string }) {
    return this.membersService.activate(body.token, body.motDePasse);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<CreateMemberDto>,
  ) {
    return this.membersService.update(id, updateDto);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.membersService.remove(id);
  }
}
