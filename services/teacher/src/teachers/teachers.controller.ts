import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  Role,
  type AuthPrincipal,
} from '@learn-and-build/nest-auth';
import type {
  PresignedUploadResponse,
  TeacherProfileDto,
} from '@learn-and-build/types';
import { TeachersService } from './teachers.service';
import { S3Service } from '../storage/s3.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';

/** Teacher self-service. Requires a valid JWT and the TEACHER role. */
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class TeachersController {
  constructor(
    private readonly teachers: TeachersService,
    private readonly s3: S3Service,
  ) {}

  @Get('me')
  async myProfile(
    @CurrentUser() user: AuthPrincipal,
  ): Promise<TeacherProfileDto> {
    const profile = await this.teachers.getByUserIdOrThrow(user.sub);
    return profile.toDto();
  }

  @Put('me')
  async upsert(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: UpsertProfileDto,
  ): Promise<TeacherProfileDto> {
    const profile = await this.teachers.upsertProfile(user.sub, dto);
    return profile.toDto();
  }

  @Post('me/documents/presign')
  presign(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignedUploadResponse> {
    return this.s3.createPresignedUpload(user.sub, dto.fileName, dto.contentType);
  }

  @Post('me/documents')
  async confirmDocument(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ConfirmDocumentDto,
  ): Promise<TeacherProfileDto> {
    const profile = await this.teachers.addDocument(user.sub, dto);
    return profile.toDto();
  }

  @Post('me/submit')
  async submit(
    @CurrentUser() user: AuthPrincipal,
  ): Promise<TeacherProfileDto> {
    const profile = await this.teachers.submitForReview(user.sub);
    return profile.toDto();
  }
}
