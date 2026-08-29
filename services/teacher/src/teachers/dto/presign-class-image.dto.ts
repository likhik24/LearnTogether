import { IsIn, IsString, MinLength } from 'class-validator';

export class PresignClassImageDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;
}
