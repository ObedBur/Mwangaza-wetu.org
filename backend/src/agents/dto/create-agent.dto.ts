import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Devise } from '@prisma/client';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  telephone: string;

  @IsString()
  @IsNotEmpty()
  guichetAssigne: string;

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
