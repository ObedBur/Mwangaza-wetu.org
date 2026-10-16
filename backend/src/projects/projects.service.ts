import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Devise, Prisma, StatutProjet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20, status?: StatutProjet) {
    const where: Prisma.ProjetWhereInput = status ? { statut: status } : {};
    const [total, data] = await Promise.all([
      this.prisma.projet.count({ where }),
      this.prisma.projet.findMany({
        where,
        orderBy: [{ dateDebut: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getStats() {
    const [total, actifs, byCategory] = await Promise.all([
      this.prisma.projet.count(),
      this.prisma.projet.count({ where: { statut: StatutProjet.EN_COURS } }),
      this.prisma.projet.groupBy({
        by: ['categorie'],
        _count: { _all: true },
        where: { statut: StatutProjet.EN_COURS },
      }),
    ]);

    return {
      total,
      actifs,
      byCategory: byCategory.map(({ categorie, _count }) => ({
        categorie,
        total: _count._all,
      })),
    };
  }

  async create(dto: CreateProjectDto) {
    this.validateBudgetCurrency(dto.budget, dto.devise);
    if (dto.dateFin && new Date(dto.dateFin) < new Date(dto.dateDebut)) {
      throw new BadRequestException(
        'La date de fin ne peut pas précéder la date de début',
      );
    }

    return this.prisma.projet.create({
      data: {
        nom: dto.nom.trim(),
        description: dto.description?.trim() || null,
        categorie: dto.categorie.trim(),
        dateDebut: new Date(dto.dateDebut),
        dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        budget: dto.budget,
        devise: dto.devise,
        statut: dto.statut ?? StatutProjet.PLANIFIE,
      },
    });
  }

  async update(id: number, dto: UpdateProjectDto) {
    const current = await this.prisma.projet.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Projet non trouvé');

    const budget = dto.budget === undefined ? current.budget : dto.budget;
    const devise = dto.devise === undefined ? current.devise : dto.devise;
    this.validateBudgetCurrency(
      budget === null ? undefined : Number(budget),
      devise ?? undefined,
    );

    const dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : current.dateDebut;
    const dateFin = dto.dateFin === undefined
      ? current.dateFin
      : dto.dateFin
        ? new Date(dto.dateFin)
        : null;
    if (dateFin && dateFin < dateDebut) {
      throw new BadRequestException(
        'La date de fin ne peut pas précéder la date de début',
      );
    }

    return this.prisma.projet.update({
      where: { id },
      data: {
        ...(dto.nom === undefined ? {} : { nom: dto.nom.trim() }),
        ...(dto.description === undefined
          ? {}
          : { description: dto.description.trim() || null }),
        ...(dto.categorie === undefined
          ? {}
          : { categorie: dto.categorie.trim() }),
        ...(dto.dateDebut === undefined ? {} : { dateDebut }),
        ...(dto.dateFin === undefined ? {} : { dateFin }),
        ...(dto.budget === undefined ? {} : { budget: dto.budget }),
        ...(dto.devise === undefined ? {} : { devise: dto.devise }),
        ...(dto.statut === undefined ? {} : { statut: dto.statut }),
      },
    });
  }

  private validateBudgetCurrency(
    budget?: number,
    currency?: Devise | null,
  ): void {
    if ((budget === undefined) !== (currency === undefined)) {
      throw new BadRequestException(
        'Le budget et sa devise doivent être fournis ensemble',
      );
    }
  }
}
