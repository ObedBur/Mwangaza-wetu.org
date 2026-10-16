import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Devise, StatutProjet } from '@prisma/client';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  nom?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  categorie?: string;

  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @IsDateString()
  @IsOptional()
  dateFin?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number | null;

  @IsEnum(Devise)
  @IsOptional()
  devise?: Devise | null;

  @IsEnum(StatutProjet)
  @IsOptional()
  statut?: StatutProjet;
}
