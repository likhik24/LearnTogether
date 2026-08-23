import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { SavedClassDto } from '@learn-and-build/types';

@Entity({ name: 'saved_classes' })
@Index('uq_saved_classes_user_ref', ['userId', 'classRef'], { unique: true })
export class SavedClass {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id' }) userId!: string;
  @Column({ name: 'class_ref' }) classRef!: string;
  @Column() title!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;

  toDto(): SavedClassDto {
    return { id: this.id, userId: this.userId, classRef: this.classRef, title: this.title, createdAt: this.createdAt.toISOString() };
  }
}
