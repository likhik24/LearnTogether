import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { ProviderPayoutProfileDto } from '@learn-and-build/types';

@Entity({ name: 'provider_payout_profiles' })
export class ProviderPayoutProfile {
  @PrimaryColumn({ name: 'teacher_id', type: 'uuid' }) teacherId!: string;
  @Column({ name: 'account_holder_name', type: 'varchar' }) accountHolderName!: string;
  @Column({ name: 'payout_method', type: 'varchar' }) payoutMethod!: 'bank' | 'upi';
  @Column({ name: 'bank_name', type: 'varchar', nullable: true }) bankName!: string | null;
  @Column({ name: 'ifsc', type: 'varchar', nullable: true }) ifsc!: string | null;
  @Column({ name: 'account_last4', type: 'varchar', length: 4, nullable: true })
  accountLast4!: string | null;
  @Column({ name: 'upi_id_masked', type: 'varchar', nullable: true }) upiIdMasked!: string | null;
  @Column({ name: 'external_fund_account_id', type: 'varchar', nullable: true })
  externalFundAccountId!: string | null;
  @Column({ name: 'kyc_status', type: 'varchar', default: 'submitted' })
  kycStatus!: ProviderPayoutProfileDto['kycStatus'];
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): ProviderPayoutProfileDto {
    return {
      teacherId: this.teacherId,
      accountHolderName: this.accountHolderName,
      payoutMethod: this.payoutMethod,
      bankName: this.bankName,
      ifsc: this.ifsc,
      accountLast4: this.accountLast4,
      upiIdMasked: this.upiIdMasked,
      externalFundAccountId: this.externalFundAccountId,
      kycStatus: this.kycStatus,
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
