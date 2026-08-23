import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { Booking } from './customer/entities/booking.entity';
import { ChildProfile } from './customer/entities/child-profile.entity';
import { CustomerNotification } from './customer/entities/customer-notification.entity';
import { SavedClass } from './customer/entities/saved-class.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>(
          'DATABASE_URL',
          'postgres://learnbuild:learnbuild@localhost:5432/learnbuild',
        ),
        entities: [User, ChildProfile, SavedClass, Booking, CustomerNotification],
        // Auto-sync schema outside production only. Use migrations in prod.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
    UsersModule,
    CustomerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
