import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { HealthController } from './health/health.controller';
import { TeacherProfile } from './teachers/entities/teacher-profile.entity';
import { TeacherDocument } from './teachers/entities/teacher-document.entity';
import { TeachersModule } from './teachers/teachers.module';

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
        entities: [TeacherProfile, TeacherDocument],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    TeachersModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
