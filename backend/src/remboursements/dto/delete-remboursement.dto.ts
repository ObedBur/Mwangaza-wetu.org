import { IsString, IsOptional, MaxLength } from 'class-validator';

export class DeleteRemboursementDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
