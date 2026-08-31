import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Role,
  Roles,
  RolesGuard,
  type AuthPrincipal,
} from '@learn-and-build/nest-auth';
import type {
  ClassReviewDto,
  ProviderRosterEntryDto,
  ProviderSessionDto,
} from '@learn-and-build/types';
import {
  ChangeOccurrenceDto,
  MarkAttendanceDto,
  ReviewBookingDto,
} from './provider-operations.dto';
import { ProviderOperationsService } from './provider-operations.service';

@Controller('provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class ProviderOperationsController {
  constructor(private readonly operations: ProviderOperationsService) {}

  @Get('sessions')
  sessions(
    @CurrentUser() user: AuthPrincipal,
    @Query('days') days?: string,
  ): Promise<ProviderSessionDto[]> {
    return this.operations.listSessions(user.sub, Number(days ?? 60));
  }

  @Get('classes/:id/roster')
  roster(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Query('start') start: string,
  ): Promise<ProviderRosterEntryDto[]> {
    return this.operations.roster(user.sub, id, start);
  }

  @Patch('bookings/:id/attendance')
  attendance(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
  ): Promise<ProviderRosterEntryDto> {
    return this.operations.markAttendance(user.sub, id, dto.status, dto.notes);
  }

  @Post('classes/:id/occurrences/change')
  change(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ChangeOccurrenceDto,
  ): Promise<ProviderSessionDto> {
    return this.operations.changeOccurrence(user.sub, id, dto);
  }
}

@Controller('customer/reviews')
@UseGuards(JwtAuthGuard)
export class CustomerReviewsController {
  constructor(private readonly operations: ProviderOperationsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal): Promise<ClassReviewDto[]> {
    return this.operations.listReviewsForCustomer(user.sub);
  }

  @Post('bookings/:id')
  review(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReviewBookingDto,
  ): Promise<ClassReviewDto> {
    return this.operations.reviewBooking(user.sub, id, dto.rating, dto.comment);
  }
}
