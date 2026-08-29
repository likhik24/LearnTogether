import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassOffering } from './class-offering.entity';
import { ClassReservation } from './class-reservation.entity';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { DemoClassesSeeder } from './demo-classes.seeder';
import { ClassModerationAudit } from './moderation-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClassOffering, ClassReservation, ClassModerationAudit])],
  controllers: [ClassesController],
  providers: [ClassesService, DemoClassesSeeder],
  exports: [ClassesService],
})
export class SchedulingModule {}
