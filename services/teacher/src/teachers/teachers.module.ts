import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherDocument } from './entities/teacher-document.entity';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { DirectoryController } from './directory.controller';
import { VerificationController } from './verification.controller';
import { S3Service } from '../storage/s3.service';
import { TeacherModerationAudit } from './entities/teacher-moderation-audit.entity';
import { PublicImagesController } from './public-images.controller';
import { PublicDirectoryController } from './public-directory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherProfile, TeacherDocument, TeacherModerationAudit])],
  controllers: [
    TeachersController,
    DirectoryController,
    VerificationController,
    PublicImagesController,
    PublicDirectoryController,
  ],
  providers: [TeachersService, S3Service],
  exports: [TeachersService],
})
export class TeachersModule {}
