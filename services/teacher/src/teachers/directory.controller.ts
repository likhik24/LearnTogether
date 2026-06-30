import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@learn-and-build/nest-auth';
import type { TeacherProfileDto } from '@learn-and-build/types';
import { TeachersService } from './teachers.service';

/**
 * Teacher discovery. Available to any authenticated user (students included),
 * so it only requires a valid JWT, not a specific role.
 */
@Controller('teachers')
@UseGuards(JwtAuthGuard)
export class DirectoryController {
  constructor(private readonly teachers: TeachersService) {}

  @Get('nearby')
  async nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ): Promise<TeacherProfileDto[]> {
    const profiles = await this.teachers.findNearby(
      Number(lat),
      Number(lng),
      Number(radius ?? '5000'),
    );
    return profiles.map((p) => p.toDto());
  }
}
