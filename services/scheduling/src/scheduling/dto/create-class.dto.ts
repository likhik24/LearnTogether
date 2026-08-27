import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InstructorGender } from '@learn-and-build/types';
import { GeoLocationDto } from './geo-location.dto';

export class ClassTimingDto {
  // ISO weekday 1=Mon .. 7=Sun (weekend daytime classes supported).
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  // Minutes from midnight; operating window enforced in the service.
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;
}

export class CreateClassDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsString()
  @MinLength(2)
  activity!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) @Max(17) ageMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(17) ageMax?: number;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() tone?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsInt() @Min(0) reviewCount?: number;
  @IsOptional() @IsString() venueName?: string;

  @IsEnum(InstructorGender)
  instructorGender!: InstructorGender;

  @IsInt()
  @Min(15)
  @Max(300)
  durationMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  seats!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ClassTimingDto)
  timings!: ClassTimingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  location?: GeoLocationDto;
}
