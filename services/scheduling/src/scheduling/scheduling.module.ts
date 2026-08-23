import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassOffering } from './class-offering.entity';
import { ClassReservation } from './class-reservation.entity';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { DemoClassesSeeder } from './demo-classes.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([ClassOffering, ClassReservation])],
  controllers: [ClassesController],
  providers: [ClassesService, DemoClassesSeeder],
  exports: [ClassesService],
})
export class SchedulingModule {}
