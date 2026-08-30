import { IsString, IsUUID, Length } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID() bookingId!: string;
}

export class VerifyPaymentDto {
  @IsString() @Length(1, 120) providerOrderId!: string;
  @IsString() @Length(1, 120) providerPaymentId!: string;
  @IsString() @Length(1, 256) signature!: string;
}
