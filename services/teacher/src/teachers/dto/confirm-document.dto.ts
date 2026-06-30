import { IsEnum, IsString, MinLength } from 'class-validator';
import { DocumentType } from '@learn-and-build/types';

export class ConfirmDocumentDto {
  @IsString()
  @MinLength(1)
  storageKey!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsEnum(DocumentType)
  type!: DocumentType;
}
