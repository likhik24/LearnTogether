import { IsEnum, IsString, MinLength } from 'class-validator';
import { DocumentType } from '@learn-and-build/types';

export class PresignUploadDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  contentType!: string;

  @IsEnum(DocumentType)
  type!: DocumentType;
}
