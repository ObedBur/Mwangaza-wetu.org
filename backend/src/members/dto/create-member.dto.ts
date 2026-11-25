import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/constants/password-policy';

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
  nom!: string;

  @IsString()
  @IsNotEmpty()
  telephone!: string;

  @IsString()
  @IsNotEmpty()
  relation!: string;

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

export class InitialDatDto {
  @IsIn([1, 3, 6, 12])
  dureeMois!: number;

  @IsIn(['FC', 'USD'])
  devise!: 'FC' | 'USD';

  @IsNumber()
  @Min(1)
  montant!: number;
}

export class CreateMemberDto {
  @IsString()
  @IsOptional()
  numeroCompte?: string;

  @IsString()
  @IsNotEmpty()
  nomComplet!: string;

  @IsString()
  @IsNotEmpty()
  dateAdhesion!: string;

  @IsOptional()
  @IsIn([1, 3, 6, 12])
  dureeAdhesionMois?: number;

  @IsOptional()
  @IsIn([1, 3, 6, 12])
  dureeEpargneMois?: number;

  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => InitialDatDto)
  @IsOptional()
  datsInitiaux?: InitialDatDto[];

  @IsOptional()
  @IsIn(['FC', 'USD'])
  deviseAdhesion?: 'FC' | 'USD';

  @IsString()
  @IsNotEmpty()
  telephone!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  adresse?: string;

  @IsEnum(Sexe)
  sexe!: Sexe;

  @IsString()
  @IsNotEmpty()
  typeCompte!: string;

  @IsString()
  @IsOptional()
  activite?: string;

  @IsEnum(StatutMembre)
  @IsNotEmpty()
  statut!: StatutMembre;

  @IsString()
  @IsOptional()
  photoProfil?: string;

  @IsString()
  @IsOptional()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
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
