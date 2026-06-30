import { IsEnum } from 'class-validator';
import { Role } from '@learn-and-build/types';

export class SetRoleDto {
  @IsEnum(Role)
  role!: Role;
}
