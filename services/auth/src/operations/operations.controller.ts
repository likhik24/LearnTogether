import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Role,
  Roles,
  RolesGuard,
  type AuthPrincipal,
} from '@learn-and-build/nest-auth';
import type {
  EmailReadinessDto,
  NotificationPreferencesDto,
  OperationJobDto,
} from '@learn-and-build/types';
import { UpdateNotificationPreferencesDto } from './operations.dto';
import { OperationsService } from './operations.service';

@Controller('customer/notification-preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  async get(@CurrentUser() user: AuthPrincipal): Promise<NotificationPreferencesDto> {
    return (await this.operations.getPreferences(user.sub)).toDto();
  }

  @Put()
  async update(
    @CurrentUser() user: AuthPrincipal,
    @Body() input: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return (await this.operations.updatePreferences(user.sub, input)).toDto();
  }
}

@Controller('admin/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class OperationsAdminController {
  constructor(private readonly operations: OperationsService) {}

  @Get('failed')
  async failed(): Promise<OperationJobDto[]> {
    return (await this.operations.listFailed()).map((item) => item.toDto());
  }

  @Get('email-readiness')
  emailReadiness(): Promise<EmailReadinessDto> {
    return this.operations.emailReadiness();
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string): Promise<OperationJobDto> {
    return (await this.operations.retry(id)).toDto();
  }
}
