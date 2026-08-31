import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ProviderPayoutStatus } from '@learn-and-build/types';

export class CreatePaymentDto {
  @IsUUID() bookingId!: string;
}

export class VerifyPaymentDto {
  @IsString() @Length(1, 120) providerOrderId!: string;
  @IsString() @Length(1, 120) providerPaymentId!: string;
  @IsString() @Length(1, 256) signature!: string;
}

export class RequestPayoutDto {
  @IsOptional()
  @IsInt()
  @Min(10000)
  amountMinor?: number;
}

export class UpdatePayoutDto {
  @IsEnum(ProviderPayoutStatus)
  status!: ProviderPayoutStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
