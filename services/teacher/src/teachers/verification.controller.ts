import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, RolesGuard, Roles, Role } from '@learn-and-build/nest-auth';
import {
  VerificationStatus,
  type AuthPrincipal,
  type ModerationAuditDto,
  type TeacherProfileDto,
} from '@learn-and-build/types';
import { TeachersService } from './teachers.service';
import { RejectDto } from './dto/reject.dto';
import { S3Service } from '../storage/s3.service';

/**
 * Admin verification actions. Wired to the shared role guards (Task 2):
 * every route requires a valid JWT AND the ADMIN role.
 */
@Controller('admin/teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class VerificationController {
  constructor(
    private readonly teachers: TeachersService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  async list(
    @Query('status') status: VerificationStatus = VerificationStatus.SUBMITTED,
  ): Promise<TeacherProfileDto[]> {
    const profiles = await this.teachers.listByStatus(status);
    return profiles.map((p) => p.toDto());
  }

  @Post(':id/start-review')
  async startReview(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<TeacherProfileDto> {
    return (await this.teachers.startReview(id, user.sub)).toDto();
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<TeacherProfileDto> {
    return (await this.teachers.approve(id, user.sub)).toDto();
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ): Promise<TeacherProfileDto> {
    return (await this.teachers.reject(id, user.sub, dto.reason)).toDto();
  }

  @Get('history')
  history(): Promise<ModerationAuditDto[]> {
    return this.teachers.moderationHistory();
  }

  @Get(':id/documents/:documentId')
  async document(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const document = await this.teachers.getDocumentForReview(id, documentId);
    const object = await this.s3.getObject(document.storageKey);
    if (!object.body) throw new NotFoundException('Teacher document not found');
    response.setHeader('content-type', object.contentType ?? 'application/octet-stream');
    response.setHeader(
      'content-disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    );
    response.setHeader('cache-control', 'private, no-store');
    object.body.pipe(response);
  }
}
