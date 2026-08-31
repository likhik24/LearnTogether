import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OperationJobStatus, type OperationJobDto } from '@learn-and-build/types';

@Entity({ name: 'operation_jobs' })
@Index('uq_operation_jobs_idempotency', ['idempotencyKey'], { unique: true })
@Index('idx_operation_jobs_dispatch', ['status', 'nextAttemptAt'])
export class OperationJob {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar' }) type!: string;
  @Column({ type: 'jsonb', default: () => "'{}'" }) payload!: Record<string, unknown>;
  @Column({ type: 'varchar', default: OperationJobStatus.PENDING }) status!: OperationJobStatus;
  @Column({ type: 'int', default: 0 }) attempts!: number;
  @Column({ name: 'max_attempts', type: 'int', default: 8 }) maxAttempts!: number;
  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt!: Date;
  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true }) lockedAt!: Date | null;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError!: string | null;
  @Column({ name: 'idempotency_key', type: 'varchar' }) idempotencyKey!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): OperationJobDto {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      nextAttemptAt: this.nextAttemptAt.toISOString(),
      lastError: this.lastError,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
