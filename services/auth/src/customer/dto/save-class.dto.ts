import { IsString, Length } from 'class-validator';

export class SaveClassDto {
  @IsString() @Length(1, 120) title!: string;
}
