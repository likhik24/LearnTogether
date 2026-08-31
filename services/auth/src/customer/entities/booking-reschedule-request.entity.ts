import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RescheduleRequestStatus, type BookingRescheduleRequestDto } from '@learn-and-build/types';

@Entity({ name: 'booking_reschedule_requests' })
@Index('uq_open_booking_reschedule', ['bookingId'], {
  unique: true,
  where: "status = 'requested'",
})
export class BookingRescheduleRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'booking_id', type: 'uuid' }) bookingId!: string;
  @Column({ name: 'class_id', type: 'uuid' }) classId!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'child_name', type: 'varchar', nullable: true }) childName!: string | null;
  @Column({ name: 'current_start', type: 'timestamptz' }) currentStart!: Date;
  @Column({ name: 'requested_start', type: 'timestamptz' }) requestedStart!: Date;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ type: 'varchar', default: RescheduleRequestStatus.REQUESTED })
  status!: RescheduleRequestStatus;
  @Column({ name: 'provider_note', type: 'text', nullable: true }) providerNote!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): BookingRescheduleRequestDto {
    return {
      id: this.id,
      bookingId: this.bookingId,
      classId: this.classId,
      userId: this.userId,
      childName: this.childName,
      currentStart: this.currentStart.toISOString(),
      requestedStart: this.requestedStart.toISOString(),
      reason: this.reason,
      status: this.status,
      providerNote: this.providerNote,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
