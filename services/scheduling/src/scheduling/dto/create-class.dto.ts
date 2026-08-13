import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InstructorGender } from '@learn-and-build/types';
import { GeoLocationDto } from './geo-location.dto';

export class ClassTimingDto {
  // ISO weekday 1=Mon .. 5=Fri (weekday-evening focus).
  @IsInt()
  @Min(1)
  @Max(5)
  weekday!: number;

  // Minutes from midnight; evening window enforced in the service.
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;
}

export class CreateClassDto {
  @IsString()
  @MinLength(2)
  activity!: string;

  @IsOptional()
  @IsString()
  description?: string;

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
