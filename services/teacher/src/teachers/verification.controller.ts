import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, Role } from '@learn-and-build/nest-auth';
import { VerificationStatus, type TeacherProfileDto } from '@learn-and-build/types';
import { TeachersService } from './teachers.service';
import { RejectDto } from './dto/reject.dto';

/**
 * Admin verification actions. Wired to the shared role guards (Task 2):
 * every route requires a valid JWT AND the ADMIN role.
 */
@Controller('admin/teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class VerificationController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  async list(
    @Query('status') status: VerificationStatus = VerificationStatus.SUBMITTED,
  ): Promise<TeacherProfileDto[]> {
    const profiles = await this.teachers.listByStatus(status);
    return profiles.map((p) => p.toDto());
  }

  @Post(':id/start-review')
  async startReview(@Param('id') id: string): Promise<TeacherProfileDto> {
    return (await this.teachers.startReview(id)).toDto();
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string): Promise<TeacherProfileDto> {
    return (await this.teachers.approve(id)).toDto();
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ): Promise<TeacherProfileDto> {
    return (await this.teachers.reject(id, dto.reason)).toDto();
  }
}
