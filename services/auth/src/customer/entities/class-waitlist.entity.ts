import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WaitlistStatus, type ClassWaitlistDto } from '@learn-and-build/types';

@Entity({ name: 'class_waitlists' })
@Index('uq_active_class_waitlist', ['userId', 'classId', 'occurrenceStart', 'childId'], {
  unique: true,
  where: "status IN ('waiting', 'offered')",
})
export class ClassWaitlist {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'class_id', type: 'uuid' }) classId!: string;
  @Column({ name: 'occurrence_start', type: 'timestamptz' }) occurrenceStart!: Date;
  @Column({ name: 'child_id', type: 'uuid' }) childId!: string;
  @Column({ name: 'child_name', type: 'varchar' }) childName!: string;
  @Column({ type: 'varchar', default: WaitlistStatus.WAITING }) status!: WaitlistStatus;
  @Column({ name: 'offer_expires_at', type: 'timestamptz', nullable: true })
  offerExpiresAt!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(position = 0): ClassWaitlistDto {
    return {
      id: this.id,
      classId: this.classId,
      occurrenceStart: this.occurrenceStart.toISOString(),
      childId: this.childId,
      childName: this.childName,
      status: this.status,
      position,
      offerExpiresAt: this.offerExpiresAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
