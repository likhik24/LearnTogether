import { IsString, MinLength } from 'class-validator';

export class ConsumeAccountTokenDto {
  @IsString()
  @MinLength(32)
  token!: string;
}
