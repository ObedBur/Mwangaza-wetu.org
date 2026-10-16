import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateParametreDto {
  @IsString()
  @IsNotEmpty()
  valeur: string;

  @IsString()
  @IsOptional()
  description?: string;
}
