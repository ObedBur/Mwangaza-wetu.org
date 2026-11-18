import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/constants/password-policy';
import { CreateDelegueDto, Sexe, StatutMembre } from './create-member.dto';

/**
 * Mise à jour d'un membre.
 *
 * Auparavant le contrôleur utilisait `Partial<CreateMemberDto>` : TypeScript
 * émet alors `Object` comme métatype, si bien que `ValidationPipe` (et son
 * `whitelist`) ne s'appliquait pas et que n'importe quel champ pouvait être
 * injecté dans le corps de la requête. Ce DTO explicite rétablit la
 * validation et le filtrage des champs inconnus.
 */
export class UpdateMemberDto {
  @IsString()
  @IsOptional()
  numeroCompte?: string;

  @IsString()
  @IsOptional()
  nomComplet?: string;

  @IsString()
  @IsOptional()
  dateAdhesion?: string;

  @IsOptional()
  @IsIn([1, 3, 6, 12])
  dureeAdhesionMois?: number;

  @IsOptional()
  @IsIn([1, 3, 6, 12])
  dureeEpargneMois?: number;

  @IsOptional()
  @IsIn(['FC', 'USD'])
  deviseAdhesion?: 'FC' | 'USD';

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsEmail()
  @IsOptional()
  email?: string | null;

  @IsString()
  @IsOptional()
  adresse?: string | null;

  @IsEnum(Sexe)
  @IsOptional()
  sexe?: Sexe;

  @IsString()
  @IsOptional()
  typeCompte?: string;

  @IsString()
  @IsOptional()
  activite?: string | null;

  @IsEnum(StatutMembre)
  @IsOptional()
  statut?: StatutMembre;

  @IsString()
  @IsOptional()
  photoProfil?: string | null;

  @IsString()
  @IsOptional()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  motDePasse?: string;

  @IsString()
  @IsOptional()
  dateNaissance?: string | null;

  @IsString()
  @IsOptional()
  idNationale?: string | null;

  @IsString()
  @IsOptional()
  userId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDelegueDto)
  delegue?: CreateDelegueDto;
}
