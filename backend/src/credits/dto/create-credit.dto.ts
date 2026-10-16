import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';

// On utilise directement l'enum Prisma pour éviter la duplication.
// L'enum est ré-exporté ici pour le confort d'import dans les autres fichiers.
export { StatutCredit } from '@prisma/client';

export class CreateCreditDto {
  @IsString()
  @IsNotEmpty()
  numeroCompte: string;

  @IsNumber()
  @IsNotEmpty()
  montant: number;

  @IsString()
  @IsNotEmpty()
  devise: string;

  @IsNumber()
  @IsOptional()
  tauxInteret?: number;

  @IsNumber()
  @IsNotEmpty()
  duree: number;

  @IsString()
  @IsNotEmpty()
  dateDebut: string;

  @IsString()
  @IsOptional()
  description?: string;
}
