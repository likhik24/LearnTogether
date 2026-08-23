import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class ReserveClassDto {
  @IsDateString() occurrenceStart!: string;
  @IsInt() @Min(1) @Max(10) seats = 1;
}
