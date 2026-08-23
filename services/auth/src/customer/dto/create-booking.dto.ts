import { IsDateString, IsInt, IsOptional, IsPositive, IsString, Length, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsString() @Length(1, 120) classRef!: string;
  @IsOptional() @IsString() @Length(1, 120) classSlug?: string;
  @IsString() @Length(1, 160) title!: string;
  @IsDateString() scheduledStart!: string;
  @IsInt() @IsPositive() amountMinor!: number;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
}
