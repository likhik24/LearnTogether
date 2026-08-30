import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { ChildProfile } from './entities/child-profile.entity';
import { SavedClass } from './entities/saved-class.entity';
import { Booking } from './entities/booking.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { SchedulingGateway } from './scheduling.gateway';
import { PaymentsGateway } from './payments.gateway';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([ChildProfile, SavedClass, Booking, CustomerNotification]),
  ],
  controllers: [CustomerController],
  providers: [CustomerService, SchedulingGateway, PaymentsGateway, JwtStrategy],
  exports: [CustomerService],
})
export class CustomerModule {}
