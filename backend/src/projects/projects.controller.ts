import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StatutProjet } from '@prisma/client';
import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Roles(...ADMIN_ROLES)
@Controller('api/projets')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('stats')
  getStats() {
    return this.projectsService.getStats();
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('statut', new ParseEnumPipe(StatutProjet, { optional: true }))
    status?: StatutProjet,
  ) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.projectsService.findAll(parsedPage, parsedPageSize, status);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, dto);
  }
}
