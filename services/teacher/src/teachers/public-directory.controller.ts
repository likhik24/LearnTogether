import { Controller, Get, Param } from '@nestjs/common';
import type { PublicTeacherProfileDto } from '@learn-and-build/types';
import { TeachersService } from './teachers.service';

@Controller('teachers/public')
export class PublicDirectoryController {
  constructor(private readonly teachers: TeachersService) {}

  @Get(':userId')
  profile(@Param('userId') userId: string): Promise<PublicTeacherProfileDto> {
    return this.teachers.getPublicProfile(userId);
  }
}
