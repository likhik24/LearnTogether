import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ClassReviewDto } from '@learn-and-build/types';

@Entity({ name: 'class_reviews' })
export class ClassReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  classId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  toDto(parentName: string): ClassReviewDto {
    return {
      id: this.id,
      bookingId: this.bookingId,
      classId: this.classId,
      userId: this.userId,
      parentName,
      rating: this.rating,
      comment: this.comment,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
