import {
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Matches,
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

export class UpsertPayoutProfileDto {
  @IsString() @Length(2, 120) accountHolderName!: string;
  @IsIn(['bank', 'upi']) payoutMethod!: 'bank' | 'upi';
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/) ifsc?: string;
  @IsOptional() @Matches(/^\d{4}$/) accountLast4?: string;
  @IsOptional() @IsString() @MaxLength(120) upiIdMasked?: string;
}

export class ReviewPayoutProfileDto {
  @IsIn(['submitted', 'verified', 'rejected'])
  status!: 'submitted' | 'verified' | 'rejected';

  @IsOptional() @IsString() @MaxLength(160) externalFundAccountId?: string;
}
