import { SupportTicketCategory } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  sujet!: string;

  @IsEnum(SupportTicketCategory)
  categorie!: SupportTicketCategory;

  @IsString()
  @MinLength(12)
  @MaxLength(3000)
  message!: string;
}
