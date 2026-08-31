import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus } from '@learn-and-build/types';
import { RescheduleRequestStatus } from '@learn-and-build/types';

export class MarkAttendanceDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ChangeOccurrenceDto {
  @IsISO8601()
  originalStart!: string;

  @IsOptional()
  @IsISO8601()
  newStart?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewBookingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class BulkAttendanceDto {
  @IsArray()
  @IsUUID('4', { each: true })
  bookingIds!: string[];

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ProviderMessageDto {
  @IsISO8601() start!: string;
  @IsString() @MaxLength(1000) message!: string;
}

export class DecideRescheduleDto {
  @IsEnum(RescheduleRequestStatus)
  status!: RescheduleRequestStatus.APPROVED | RescheduleRequestStatus.DECLINED;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
