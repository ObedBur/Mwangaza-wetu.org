import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  compte: string;

  @IsString()
  @IsNotEmpty()
  devise: string;

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
