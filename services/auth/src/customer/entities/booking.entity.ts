import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BookingStatus, type BookingDto } from '@learn-and-build/types';

@Entity({ name: 'customer_bookings' })
@Index('uq_customer_booking_active_slot', ['userId', 'classRef', 'scheduledStart'], { unique: true, where: '"status" = \'confirmed\'' })
export class Booking {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'user_id' }) userId!: string;
  @Column({ name: 'class_ref' }) classRef!: string;
  @Column() title!: string;
  @Column({ name: 'scheduled_start', type: 'timestamptz' }) scheduledStart!: Date;
  @Column({ name: 'amount_minor', type: 'int' }) amountMinor!: number;
  @Column({ length: 3, default: 'INR' }) currency!: string;
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED }) status!: BookingStatus;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): BookingDto {
    return { id: this.id, userId: this.userId, classRef: this.classRef, title: this.title, scheduledStart: this.scheduledStart.toISOString(), amountMinor: this.amountMinor, currency: this.currency, status: this.status, createdAt: this.createdAt.toISOString(), updatedAt: this.updatedAt.toISOString() };
  }
}
