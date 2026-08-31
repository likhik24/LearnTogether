import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { NotificationPreferencesDto } from '@learn-and-build/types';

@Entity({ name: 'notification_preferences' })
export class NotificationPreference {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'email_enabled', default: true }) emailEnabled!: boolean;
  @Column({ name: 'booking_reminders', default: true }) bookingReminders!: boolean;
  @Column({ name: 'product_updates', default: false }) productUpdates!: boolean;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  toDto(): NotificationPreferencesDto {
    return {
      emailEnabled: this.emailEnabled,
      bookingReminders: this.bookingReminders,
      productUpdates: this.productUpdates,
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
