import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ModerationAuditDto } from '@learn-and-build/types';

@Entity({ name: 'teacher_moderation_audits' })
export class TeacherModerationAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'teacher_profile_id', type: 'uuid' })
  teacherProfileId!: string;

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
      resourceType: 'teacher',
      resourceId: this.teacherProfileId,
      action: this.action,
      actorId: this.actorId,
      note: this.note,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
