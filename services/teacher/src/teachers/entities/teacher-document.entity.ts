import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentType, type TeacherDocumentDto } from '@learn-and-build/types';
import { TeacherProfile } from './teacher-profile.entity';

@Entity({ name: 'teacher_documents' })
export class TeacherDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TeacherProfile, (profile) => profile.documents, {
    onDelete: 'CASCADE',
  })
  profile!: TeacherProfile;

  @Column({ type: 'enum', enum: DocumentType, default: DocumentType.OTHER })
  type!: DocumentType;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ name: 'storage_key' })
  storageKey!: string;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt!: Date;

  toDto(): TeacherDocumentDto {
    return {
      id: this.id,
      type: this.type,
      fileName: this.fileName,
      storageKey: this.storageKey,
      uploadedAt: this.uploadedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
