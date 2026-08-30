import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OccurrenceStatus } from '@learn-and-build/types';

@Entity({ name: 'class_occurrence_overrides' })
@Index('uq_class_occurrence_override', ['classId', 'originalStart'], { unique: true })
export class ClassOccurrenceOverride {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'class_id', type: 'uuid' }) classId!: string;
  @Column({ name: 'original_start', type: 'timestamptz' }) originalStart!: Date;
  @Column({ name: 'replacement_start', type: 'timestamptz', nullable: true }) replacementStart!: Date | null;
  @Column({ type: 'varchar' }) status!: OccurrenceStatus;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
