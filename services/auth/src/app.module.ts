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
import { AuthSession } from './auth/auth-session.entity';
import { AccountToken } from './auth/account-token.entity';

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
        entities: [
          User,
          ChildProfile,
          SavedClass,
          Booking,
          CustomerNotification,
          AuthSession,
          AccountToken,
        ],
        // Production bootstrap may opt in exactly once on an empty database.
        // Keep it disabled afterwards and use reviewed migrations for changes.
        synchronize:
          config.get<string>('DB_SYNCHRONIZE') === 'true' ||
          (config.get<string>('DB_SYNCHRONIZE') == null &&
            config.get<string>('NODE_ENV') !== 'production'),
      }),
    }),
    AuthModule,
    UsersModule,
    CustomerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
