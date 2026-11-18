import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/constants/password-policy';

export class ActivateMemberDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  motDePasse!: string;
}
