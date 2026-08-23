import { IsDateString, IsInt, IsPositive, IsString, Length, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsString() @Length(1, 120) classRef!: string;
  @IsString() @Length(1, 160) title!: string;
  @IsDateString() scheduledStart!: string;
  @IsInt() @IsPositive() amountMinor!: number;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
}
