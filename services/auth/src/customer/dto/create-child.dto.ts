import { IsArray, IsDateString, IsHexColor, IsOptional, IsString, Length } from 'class-validator';

export class CreateChildDto {
  @IsString() @Length(1, 80) name!: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
  @IsOptional() @IsHexColor() avatarColor?: string;
}
