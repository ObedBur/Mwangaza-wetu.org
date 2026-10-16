import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @MinLength(4)
  password: string;
}
