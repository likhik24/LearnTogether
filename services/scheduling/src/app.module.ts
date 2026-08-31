import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiRateLimitGuard, JwtStrategy } from '@learn-and-build/nest-auth';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { ClassOffering } from './scheduling/class-offering.entity';
import { ClassReservation } from './scheduling/class-reservation.entity';
import { SchedulingModule } from './scheduling/scheduling.module';
import { ClassModerationAudit } from './scheduling/moderation-audit.entity';
import { ClassOccurrenceOverride } from './scheduling/class-occurrence-override.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>(
          'DATABASE_URL',
          'postgres://learnbuild:learnbuild@localhost:5432/learnbuild',
        ),
        entities: [ClassOffering, ClassReservation, ClassModerationAudit, ClassOccurrenceOverride],
        synchronize:
          config.get<string>('DB_SYNCHRONIZE') === 'true' ||
          (config.get<string>('DB_SYNCHRONIZE') == null &&
            config.get<string>('NODE_ENV') !== 'production'),
      }),
    }),
    SchedulingModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy, { provide: APP_GUARD, useClass: ApiRateLimitGuard }],
})
export class AppModule {}
