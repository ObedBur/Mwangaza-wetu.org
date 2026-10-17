import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsPositive,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { TypeOperationEpargne as TypeOperation, Devise } from '@prisma/client';

export { TypeOperation, Devise };

export class CreateSavingsDto {
  @IsString()
  @IsNotEmpty()
  compte: string;

  @IsEnum(TypeOperation)
  @IsNotEmpty()
  typeOperation: TypeOperation;

  @IsEnum(Devise)
  @IsNotEmpty()
  devise: Devise;

  @IsNumber()
  @IsPositive()
  montant: number;

  @IsDateString()
  @IsNotEmpty()
  dateOperation: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsOptional()
  biometricUserId?: string;
}
