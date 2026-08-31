import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiRateLimitGuard, JwtStrategy } from '@learn-and-build/nest-auth';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { TeacherProfile } from './teachers/entities/teacher-profile.entity';
import { TeacherDocument } from './teachers/entities/teacher-document.entity';
import { TeachersModule } from './teachers/teachers.module';
import { AuthDiscoveryModule } from './auth-discovery/auth-discovery.module';
import { TeacherModerationAudit } from './teachers/entities/teacher-moderation-audit.entity';

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
        entities: [TeacherProfile, TeacherDocument, TeacherModerationAudit],
        synchronize:
          config.get<string>('DB_SYNCHRONIZE') === 'true' ||
          (config.get<string>('DB_SYNCHRONIZE') == null &&
            config.get<string>('NODE_ENV') !== 'production'),
      }),
    }),
    TeachersModule,
    AuthDiscoveryModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy, { provide: APP_GUARD, useClass: ApiRateLimitGuard }],
})
export class AppModule {}
