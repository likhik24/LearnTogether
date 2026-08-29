import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ModerationAuditDto } from '@learn-and-build/types';

@Entity({ name: 'class_moderation_audits' })
export class ClassModerationAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  classId!: string;

  @Column()
  action!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  toDto(): ModerationAuditDto {
    return {
      id: this.id,
      resourceType: 'class',
      resourceId: this.classId,
      action: this.action,
      actorId: this.actorId,
      note: this.note,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
