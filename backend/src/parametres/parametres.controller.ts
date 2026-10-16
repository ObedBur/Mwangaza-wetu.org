import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ParametresService } from './parametres.service';
import { UpdateParametreDto } from './dto/update-parametre.dto';

@Roles(...ADMIN_ROLES)
@Controller('api/parametres')
export class ParametresController {
  constructor(private readonly parametresService: ParametresService) {}

  @Get()
  async findAll() {
    return this.parametresService.findAll();
  }

  @Get('sync-taux')
  async syncTaux() {
    const rate = await this.parametresService.syncExchangeRate();
    return { success: rate > 0, rate };
  }

  @Get(':nom')
  async findOne(@Param('nom') nom: string) {
    return this.parametresService.findByName(nom);
  }

  // Modification des taux / paramètres financiers : superadmin uniquement
  @Roles(...SUPERADMIN_ROLES)
  @Patch(':nom')
  async update(@Param('nom') nom: string, @Body() dto: UpdateParametreDto) {
    return this.parametresService.update(nom, dto);
  }
}
