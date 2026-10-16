import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Devise, StatutProjet } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  categorie: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

  @IsEnum(Devise)
  @IsOptional()
  devise?: Devise;

  @IsEnum(StatutProjet)
  @IsOptional()
  statut?: StatutProjet;
}
