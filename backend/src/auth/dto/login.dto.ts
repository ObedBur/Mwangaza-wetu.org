import {
  IsEmail,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  accountNumber?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
