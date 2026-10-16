import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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
  @MinLength(6)
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
