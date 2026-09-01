import { Equals, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@learn-and-build/types';
import { IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms and Privacy Policy' })
  termsAccepted!: boolean;

  /**
   * Optional self-selected role at signup. Only USER and TEACHER are allowed
   * here; ADMIN can only be granted by an existing admin.
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
