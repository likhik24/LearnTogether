import {
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AvailabilityDay,
  ChildAgeGroup,
  ChildrenExperience,
  ClassVenuePreference,
  ProviderAgeBand,
  ProviderCategory,
  ProviderExperience,
  SessionFrequency,
  TeachingFormat,
  TimeSlot,
  TravelRadius,
} from '@learn-and-build/types';

export class GeoLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class UpsertProfileDto {
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  location?: GeoLocationDto;

  // --- Provider onboarding + availability ---

  // Section 1 — contact + basics
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsEnum(ProviderAgeBand) ageBand?: ProviderAgeBand;
  @IsOptional() @IsString() locality?: string;
  @IsOptional() @IsString() city?: string;

  // Section 2 — what they teach
  @IsOptional() @IsEnum(ProviderCategory) category?: ProviderCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subcategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional() @IsString() skillDescription?: string;
  @IsOptional() @IsEnum(ProviderExperience) yearsExperience?: ProviderExperience;

  // Section 3 — portfolio + child experience
  @IsOptional() @IsString() portfolio?: string;
  @IsOptional() @IsEnum(ChildrenExperience) childrenExperience?: ChildrenExperience;
  @IsOptional() @IsString() childrenExperienceDetail?: string;

  // Section 4 — teaching preferences
  @IsOptional()
  @IsArray()
  @IsEnum(ChildAgeGroup, { each: true })
  childAgeGroups?: ChildAgeGroup[];

  @IsOptional()
  @IsArray()
  @IsEnum(TeachingFormat, { each: true })
  teachingFormats?: TeachingFormat[];

  @IsOptional()
  @IsArray()
  @IsEnum(ClassVenuePreference, { each: true })
  venuePreferences?: ClassVenuePreference[];

  @IsOptional() @IsEnum(TravelRadius) travelRadius?: TravelRadius;

  // Section 5 — availability
  @IsOptional()
  @IsArray()
  @IsEnum(AvailabilityDay, { each: true })
  availableDays?: AvailabilityDay[];

  @IsOptional()
  @IsArray()
  @IsEnum(TimeSlot, { each: true })
  timeSlots?: TimeSlot[];

  @IsOptional() @IsString() preferredAvailability?: string;
  @IsOptional() @IsEnum(SessionFrequency) sessionFrequency?: SessionFrequency;

  // Final — motivation
  @IsOptional() @IsString() whyJoin?: string;
}
