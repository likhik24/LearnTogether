import { IsEmail } from 'class-validator';

export class RequestAccountTokenDto {
  @IsEmail()
  email!: string;
}
