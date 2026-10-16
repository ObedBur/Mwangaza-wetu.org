import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsPositive,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class CreateRemboursementDto {
  @IsOptional()
  @IsEnum(['semaine', '2semaines', 'mois'])
  frequencePaiement?: string;
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  creditId: number;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  montant: number;

  @IsEnum(['FC', 'USD'])
  @IsNotEmpty()
  devise: string;

  @IsDateString()
  @IsNotEmpty()
  dateRemboursement: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
