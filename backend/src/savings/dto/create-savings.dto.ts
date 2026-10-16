import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
  @IsNotEmpty()
  montant: number;

  @IsString()
  @IsNotEmpty()
  dateOperation: string;

  @IsString()
  @IsOptional()
  description?: string;
}
