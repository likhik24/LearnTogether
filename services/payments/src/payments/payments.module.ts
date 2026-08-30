import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayGateway } from './razorpay.gateway';
import { ProviderPayout } from './provider-payout.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentWebhookEvent, ProviderPayout])],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway],
})
export class PaymentsModule {}
