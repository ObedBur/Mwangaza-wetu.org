import { IsIn, IsInt, Min } from 'class-validator';

export class UnlockAccountDto {
  @IsIn(['admin', 'superadmin', 'agent', 'member'])
  role!: 'admin' | 'superadmin' | 'agent' | 'member';

  @IsInt()
  @Min(1)
  id!: number;
}
