import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'payment_webhook_events' })
export class PaymentWebhookEvent {
  @PrimaryColumn({ name: 'event_id' }) eventId!: string;
  @Column() event!: string;
  @CreateDateColumn({ name: 'processed_at' }) processedAt!: Date;
}
