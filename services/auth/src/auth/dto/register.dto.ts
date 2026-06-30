import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@learn-and-build/types';
import { IsEnum } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  /**
   * Optional self-selected role at signup. Only USER and TEACHER are allowed
   * here; ADMIN can only be granted by an existing admin.
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
