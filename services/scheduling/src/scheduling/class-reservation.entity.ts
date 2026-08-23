import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ReservationStatus, type ClassReservationDto } from '@learn-and-build/types';
import { ClassOffering } from './class-offering.entity';

@Entity({ name: 'class_reservations' })
@Index('uq_active_class_reservation', ['userId', 'classId', 'occurrenceStart'], { unique: true, where: '"status" = \'reserved\'' })
@Index('idx_reservation_inventory', ['classId', 'occurrenceStart', 'status'])
export class ClassReservation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'class_id', type: 'uuid' }) classId!: string;
  @ManyToOne(() => ClassOffering, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  offering!: ClassOffering;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'occurrence_start', type: 'timestamptz' }) occurrenceStart!: Date;
  @Column({ type: 'int', default: 1 }) seats!: number;
  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.RESERVED }) status!: ReservationStatus;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): ClassReservationDto {
    return {
      id: this.id,
      classId: this.classId,
      userId: this.userId,
      occurrenceStart: this.occurrenceStart.toISOString(),
      seats: this.seats,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
