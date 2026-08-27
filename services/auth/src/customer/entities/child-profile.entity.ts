import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ChildProfileDto } from '@learn-and-build/types';

@Entity({ name: 'child_profiles' })
export class ChildProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column()
  name!: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  interests!: string[];

  @Column({ name: 'avatar_color', default: '#7c5cff' })
  avatarColor!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  toDto(): ChildProfileDto {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      birthDate: this.birthDate ?? null,
      interests: this.interests ?? [],
      avatarColor: this.avatarColor,
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
