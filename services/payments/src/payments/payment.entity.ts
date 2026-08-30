import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentStatus, type PaymentDto } from '@learn-and-build/types';

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Index({ unique: true }) @Column({ name: 'booking_id', type: 'uuid' }) bookingId!: string;
  @Column({ name: 'class_id' }) classId!: string;
  @Column({ name: 'amount_minor', type: 'int' }) amountMinor!: number;
  @Column({ length: 3 }) currency!: string;
  @Column({ type: 'varchar' }) status!: PaymentStatus;
  @Column({ default: 'razorpay' }) provider!: string;
  @Index({ unique: true }) @Column({ name: 'provider_order_id', type: 'varchar', nullable: true }) providerOrderId!: string | null;
  @Column({ name: 'provider_ref', type: 'varchar', nullable: true }) providerRef!: string | null;
  @Column({ name: 'failure_reason', type: 'text', nullable: true }) failureReason!: string | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): PaymentDto {
    return {
      id: this.id,
      userId: this.userId,
      bookingId: this.bookingId,
      classId: this.classId,
      amountMinor: this.amountMinor,
      currency: this.currency,
      status: this.status,
      provider: this.provider,
      providerRef: this.providerRef,
      providerOrderId: this.providerOrderId,
      failureReason: this.failureReason,
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
