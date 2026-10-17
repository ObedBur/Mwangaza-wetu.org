import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(3000)
  message!: string;
}
