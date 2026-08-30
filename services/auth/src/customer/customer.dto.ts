import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
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
