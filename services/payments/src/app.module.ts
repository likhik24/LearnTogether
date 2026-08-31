import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { HealthController } from './health/health.controller';
import { Payment } from './payments/payment.entity';
import { PaymentWebhookEvent } from './payments/payment-webhook-event.entity';
import { PaymentsModule } from './payments/payments.module';
import { ProviderPayout } from './payments/provider-payout.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL', 'postgres://learnbuild:learnbuild@localhost:5432/learnbuild'),
        entities: [Payment, PaymentWebhookEvent, ProviderPayout],
        synchronize:
          config.get<string>('DB_SYNCHRONIZE') === 'true' ||
          (config.get<string>('DB_SYNCHRONIZE') == null &&
            config.get<string>('NODE_ENV') !== 'production'),
      }),
    }),
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
