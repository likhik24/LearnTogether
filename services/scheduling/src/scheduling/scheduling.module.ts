import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassOffering } from './class-offering.entity';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClassOffering])],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class SchedulingModule {}
