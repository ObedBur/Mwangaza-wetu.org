import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import { CreateAdminDto, ConfirmAdminDto } from './dto/create-admin.dto';

@Roles(...ADMIN_ROLES)
@Controller('api/admin')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get('last-number')
  async getLastAdminNumber() {
    return this.adminsService.getLastAdminNumber();
  }

  @Get()
  async findAll() {
    return this.adminsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminsService.findOne(id);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Post()
  async create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Post('confirm')
  async confirm(@Body() dto: ConfirmAdminDto) {
    return this.adminsService.confirm(dto);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateAdminDto>,
  ) {
    return this.adminsService.update(id, dto);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminsService.remove(id);
  }
}
