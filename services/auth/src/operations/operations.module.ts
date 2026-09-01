import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { AuthModule } from '../auth/auth.module';
import { CustomerModule } from '../customer/customer.module';
import {
  NotificationPreferencesController,
  OperationsAdminController,
} from './operations.controller';
import { NotificationPreference } from './notification-preference.entity';
import { OperationJob } from './operation-job.entity';
import { OperationsService } from './operations.service';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([OperationJob, NotificationPreference]),
    AuthModule,
    CustomerModule,
  ],
  controllers: [NotificationPreferencesController, OperationsAdminController],
  providers: [OperationsService, JwtStrategy],
  exports: [OperationsService],
})
export class OperationsModule {}
