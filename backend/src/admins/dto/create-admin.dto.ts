import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/constants/password-policy';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  telephone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  motDePasse: string;

  @IsIn(['admin', 'superadmin'])
  @IsNotEmpty()
  role: 'admin' | 'superadmin';

  @IsString()
  @IsNotEmpty()
  numeroCompte: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  actif?: boolean;
}

export class ConfirmAdminDto {
  @IsNotEmpty()
  adminId: number;

  @IsString()
  @IsNotEmpty()
  confirmationCode: string;
}
