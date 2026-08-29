import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  reason?: string;
}
