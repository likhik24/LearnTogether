import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { ChildProfile } from './entities/child-profile.entity';
import { SavedClass } from './entities/saved-class.entity';
import { Booking } from './entities/booking.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { ClassReview } from './entities/class-review.entity';
import { ClassWaitlist } from './entities/class-waitlist.entity';
import { BookingRescheduleRequest } from './entities/booking-reschedule-request.entity';
import {
  CustomerReviewsController,
  ProviderOperationsController,
} from './provider-operations.controller';
import { ProviderOperationsService } from './provider-operations.service';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { SchedulingGateway } from './scheduling.gateway';
import { PaymentsGateway } from './payments.gateway';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([
      ChildProfile,
      SavedClass,
      Booking,
      CustomerNotification,
      ClassReview,
      ClassWaitlist,
      BookingRescheduleRequest,
    ]),
  ],
  controllers: [CustomerController, ProviderOperationsController, CustomerReviewsController],
  providers: [
    CustomerService,
    ProviderOperationsService,
    SchedulingGateway,
    PaymentsGateway,
    JwtStrategy,
  ],
  exports: [CustomerService, PaymentsGateway],
})
export class CustomerModule {}
