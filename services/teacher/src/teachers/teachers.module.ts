import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherDocument } from './entities/teacher-document.entity';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { DirectoryController } from './directory.controller';
import { VerificationController } from './verification.controller';
import { S3Service } from '../storage/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherProfile, TeacherDocument])],
  controllers: [
    TeachersController,
    DirectoryController,
    VerificationController,
  ],
  providers: [TeachersService, S3Service],
  exports: [TeachersService],
})
export class TeachersModule {}
