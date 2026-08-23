import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { CustomerNotificationDto } from '@learn-and-build/types';

@Entity({ name: 'customer_notifications' })
export class CustomerNotification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'user_id' }) userId!: string;
  @Column({ default: 'general' }) kind!: string;
  @Column() title!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;

  toDto(): CustomerNotificationDto {
    return { id: this.id, userId: this.userId, kind: this.kind, title: this.title, body: this.body, readAt: this.readAt?.toISOString() ?? null, createdAt: this.createdAt.toISOString() };
  }
}
