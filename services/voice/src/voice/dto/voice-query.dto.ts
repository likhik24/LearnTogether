import { IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

export class VoiceQueryDto {
  @IsString()
  @MinLength(1)
  transcript!: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}
