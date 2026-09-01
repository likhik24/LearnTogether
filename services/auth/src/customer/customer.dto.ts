import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateChildDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  avatarColor?: string;
}

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  avatarColor?: string;
}

export class SaveClassDto {
  @IsOptional()
  @IsString()
  title?: string;
}

export class CreateBookingDto {
  @IsUUID()
  childId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  childIds?: string[];

  @IsString()
  @MinLength(1)
  classRef!: string;

  @IsOptional()
  @IsString()
  classSlug?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsISO8601()
  scheduledStart!: string;

  @IsOptional()
  @IsInt()
  amountMinor?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class JoinWaitlistDto {
  @IsUUID() childId!: string;
  @IsUUID() classId!: string;
  @IsISO8601() occurrenceStart!: string;
}

export class RequestBookingRescheduleDto {
  @IsISO8601() requestedStart!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
