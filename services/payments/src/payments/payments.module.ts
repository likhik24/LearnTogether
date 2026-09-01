import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayGateway } from './razorpay.gateway';
import { ProviderPayout } from './provider-payout.entity';
import { ProviderPayoutProfile } from './provider-payout-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentWebhookEvent, ProviderPayout, ProviderPayoutProfile]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway],
})
export class PaymentsModule {}
