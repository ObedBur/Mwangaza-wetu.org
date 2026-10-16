import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum Sexe {
  M = 'M',
  F = 'F',
  AUTRE = 'AUTRE',
}

export enum StatutMembre {
  ACTIF = 'actif',
  INACTIF = 'inactif',
}

export class CreateDelegueDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  telephone: string;

  @IsString()
  @IsNotEmpty()
  relation: string;

  @IsString()
  @IsOptional()
  pieceIdentite?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  photoProfil?: string;
}

export class CreateMemberDto {
  @IsString()
  @IsOptional()
  numeroCompte?: string;

  @IsString()
  @IsNotEmpty()
  nomComplet: string;

  @IsString()
  @IsNotEmpty()
  dateAdhesion: string;

  @IsString()
  @IsNotEmpty()
  telephone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  adresse?: string;

  @IsEnum(Sexe)
  sexe: Sexe;

  @IsString()
  @IsNotEmpty()
  typeCompte: string;

  @IsString()
  @IsOptional()
  activite?: string;

  @IsEnum(StatutMembre)
  @IsNotEmpty()
  statut: StatutMembre;

  @IsString()
  @IsOptional()
  photoProfil?: string;

  @IsString()
  @IsOptional()
  @MinLength(4)
  motDePasse?: string;

  @IsString()
  @IsOptional()
  dateNaissance?: string;

  @IsString()
  @IsOptional()
  idNationale?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDelegueDto)
  delegue?: CreateDelegueDto;
}
