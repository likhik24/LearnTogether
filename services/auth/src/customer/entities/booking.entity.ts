import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttendanceStatus, BookingStatus, type BookingDto } from '@learn-and-build/types';

@Entity({ name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'class_ref' })
  classRef!: string;

  @Column({ name: 'class_slug', type: 'varchar', nullable: true })
  classSlug!: string | null;

  @Column({ name: 'reservation_id', type: 'varchar', nullable: true })
  reservationId!: string | null;

  @Index()
  @Column({ name: 'child_id', type: 'uuid', nullable: true })
  childId!: string | null;

  @Column({ name: 'child_name', type: 'varchar', nullable: true })
  childName!: string | null;

  @Column({ name: 'seat_count', type: 'int', default: 1 })
  seatCount!: number;

  @Column()
  title!: string;

  @Column({ name: 'scheduled_start', type: 'timestamptz' })
  scheduledStart!: Date;

  @Column({ name: 'amount_minor', type: 'int', default: 0 })
  amountMinor!: number;

  @Column({ default: 'INR' })
  currency!: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING_PAYMENT })
  status!: BookingStatus;

  @Column({ name: 'attendance_status', type: 'varchar', nullable: true })
  attendanceStatus!: AttendanceStatus | null;

  @Column({ name: 'attendance_notes', type: 'text', nullable: true })
  attendanceNotes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  toDto(): BookingDto {
    return {
      id: this.id,
      userId: this.userId,
      classRef: this.classRef,
      classSlug: this.classSlug ?? null,
      reservationId: this.reservationId ?? null,
      childId: this.childId ?? null,
      childName: this.childName ?? null,
      seatCount: this.seatCount ?? 1,
      title: this.title,
      scheduledStart: this.scheduledStart?.toISOString() ?? new Date().toISOString(),
      amountMinor: this.amountMinor,
      currency: this.currency,
      status: this.status,
      attendanceStatus: this.attendanceStatus ?? null,
      attendanceNotes: this.attendanceNotes ?? null,
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
