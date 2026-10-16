import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Devise } from '@prisma/client';

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  nom?: string;

  @IsDateString()
  @IsOptional()
  dateNaissance?: string;

  @IsString()
  @IsOptional()
  numeroCarteElecteur?: string;

  @IsString()
  @IsOptional()
  imageCarteElecteur?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsString()
  @IsOptional()
  guichetAssigne?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  soldeInitial?: number;

  @IsEnum(Devise)
  @IsOptional()
  devise?: Devise;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  motDePasse?: string;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;

  @IsBoolean()
  @IsOptional()
  biometricValidated?: boolean;

  @IsString()
  @IsOptional()
  adminPassword?: string;
}
