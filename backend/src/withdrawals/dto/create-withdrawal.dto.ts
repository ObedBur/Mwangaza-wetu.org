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
