import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SavedClass } from './entities/saved-class.entity';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChildProfile, SavedClass, Booking, CustomerNotification])],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
