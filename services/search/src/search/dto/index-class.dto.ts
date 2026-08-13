import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeoLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class IndexClassDto {
  @IsString()
  @MinLength(1)
  classId!: string;

  @IsString()
  @MinLength(1)
  teacherId!: string;

  @IsString()
  @MinLength(1)
  activity!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  location?: GeoLocationDto;
}
