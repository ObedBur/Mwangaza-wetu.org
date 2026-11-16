import { IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateMemberDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  motDePasse!: string;
}
