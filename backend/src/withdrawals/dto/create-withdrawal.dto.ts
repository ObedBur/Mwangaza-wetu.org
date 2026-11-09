import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import { Devise } from '@prisma/client';

export class CreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  compte: string;

  @IsEnum(Devise)
  devise: Devise;

  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  montant: number;

  @IsDateString()
  @IsOptional()
  dateOperation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsUUID()
  idempotencyKey: string;

  /**
   * Mode dégradé : permet à un admin-agent de contourner la vérification
   * biométrique quand le lecteur ZKTeco est physiquement en panne.
   * Le motif du contournement est obligatoire et sera tracé dans les logs.
   */
  @IsBoolean()
  @IsOptional()
  skipBiometric?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  motifSkipBiometric?: string;
}

export class VerifyWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  compte: string;

  @IsEnum(Devise)
  devise: Devise;

  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  montant: number;
}

export class CancelWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motif: string;

  @IsBoolean()
  cashRecupere: boolean;
}

export class FundAgentCashboxDto {
  @IsEnum(Devise)
  devise: Devise;

  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  montant: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motif: string;

  @IsUUID()
  idempotencyKey: string;
}
