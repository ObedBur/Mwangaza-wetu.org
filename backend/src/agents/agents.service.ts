import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import * as bcrypt from 'bcrypt';

const AGENT_SELECT = {
  id: true,
  nom: true,
  email: true,
  telephone: true,
  guichetAssigne: true,
  soldeInitial: true,
  devise: true,
  actif: true,
  userId: true,
  createdAt: true,
} as const;

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAgentDto) {
    const emailExists = await this.prisma.agent.findUnique({
      where: { email: dto.email },
    });
    if (emailExists) {
      throw new BadRequestException('Un agent avec cet email existe déjà');
    }

    if (dto.userId) {
      const userIdTaken = await this.prisma.agent.findUnique({
        where: { userId: dto.userId },
      });
      if (userIdTaken) {
        throw new BadRequestException(
          'Cette empreinte est déjà enregistrée pour un autre agent',
        );
      }
    }

    const hashedPassword = dto.motDePasse
      ? await bcrypt.hash(dto.motDePasse, 10)
      : null;

    return this.prisma.agent.create({
      data: {
        nom: dto.nom,
        email: dto.email,
        telephone: dto.telephone,
        guichetAssigne: dto.guichetAssigne,
        soldeInitial: dto.soldeInitial ?? 0,
        devise: dto.devise ?? 'USD',
        userId: dto.userId ?? null,
        motDePasse: hashedPassword,
      },
      select: AGENT_SELECT,
    });
  }

  async findAll(page = 1, pageSize = 10, search?: string) {
    const where = search
      ? {
          OR: [
            { nom: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            {
              guichetAssigne: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            { telephone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: AGENT_SELECT,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: rows,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      select: AGENT_SELECT,
    });
    if (!agent) throw new NotFoundException(`Agent #${id} non trouvé`);
    return agent;
  }

  async update(id: number, dto: UpdateAgentDto) {
    const existing = await this.prisma.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Agent #${id} non trouvé`);

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.agent.findUnique({
        where: { email: dto.email },
      });
      if (emailTaken) {
        throw new BadRequestException('Un agent avec cet email existe déjà');
      }
    }

    if (dto.userId && dto.userId !== existing.userId) {
      const userIdTaken = await this.prisma.agent.findUnique({
        where: { userId: dto.userId },
      });
      if (userIdTaken) {
        throw new BadRequestException(
          'Cette empreinte est déjà enregistrée pour un autre agent',
        );
      }
    }

    return this.prisma.agent.update({
      where: { id },
      select: AGENT_SELECT,
      data: {
        ...(dto.nom !== undefined && { nom: dto.nom }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.telephone !== undefined && { telephone: dto.telephone }),
        ...(dto.guichetAssigne !== undefined && {
          guichetAssigne: dto.guichetAssigne,
        }),
        ...(dto.soldeInitial !== undefined && {
          soldeInitial: dto.soldeInitial,
        }),
        ...(dto.devise !== undefined && { devise: dto.devise }),
        ...(dto.actif !== undefined && { actif: dto.actif }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
        ...(dto.motDePasse !== undefined && {
          motDePasse: await bcrypt.hash(dto.motDePasse, 10),
        }),
      },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Agent #${id} non trouvé`);

    return this.prisma.agent.delete({ where: { id }, select: AGENT_SELECT });
  }
}
