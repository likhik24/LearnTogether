import { IsEnum } from 'class-validator';
import { ClassOfferingStatus } from '@learn-and-build/types';

export class ClassStatusDto {
  @IsEnum(ClassOfferingStatus)
  status!: ClassOfferingStatus;
}
