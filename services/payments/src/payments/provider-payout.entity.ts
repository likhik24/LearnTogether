import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProviderPayoutStatus, type ProviderPayoutDto } from '@learn-and-build/types';

@Entity({ name: 'provider_payouts' })
@Index('UQ_provider_payout_active_teacher', ['teacherId'], {
  unique: true,
  where: "status IN ('requested', 'processing')",
})
export class ProviderPayout {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'teacher_id', type: 'uuid' }) teacherId!: string;
  @Column({ name: 'amount_minor', type: 'int' }) amountMinor!: number;
  @Column({ length: 3, default: 'INR' }) currency!: string;
  @Index() @Column({ type: 'varchar', default: ProviderPayoutStatus.REQUESTED }) status!: ProviderPayoutStatus;
  @Column({ type: 'varchar', nullable: true }) reference!: string | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): ProviderPayoutDto {
    return {
      id: this.id,
      teacherId: this.teacherId,
      amountMinor: this.amountMinor,
      currency: this.currency,
      status: this.status,
      reference: this.reference,
      note: this.note,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
