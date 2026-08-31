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
  BookingRescheduleRequestDto,
} from '@learn-and-build/types';
import {
  ChangeOccurrenceDto,
  BulkAttendanceDto,
  DecideRescheduleDto,
  MarkAttendanceDto,
  ProviderMessageDto,
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

  @Get('reschedule-requests')
  rescheduleRequests(@CurrentUser() user: AuthPrincipal): Promise<BookingRescheduleRequestDto[]> {
    return this.operations.listRescheduleRequests(user.sub);
  }

  @Post('reschedule-requests/:id/decision')
  decideReschedule(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: DecideRescheduleDto,
  ): Promise<BookingRescheduleRequestDto> {
    return this.operations.decideReschedule(user.sub, id, dto.status, dto.note);
  }

  @Patch('attendance/bulk')
  bulkAttendance(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: BulkAttendanceDto,
  ): Promise<ProviderRosterEntryDto[]> {
    return this.operations.bulkAttendance(user.sub, dto.bookingIds, dto.status, dto.notes);
  }

  @Post('classes/:id/message')
  messageSession(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ProviderMessageDto,
  ): Promise<{ recipients: number }> {
    return this.operations.messageSession(user.sub, id, dto.start, dto.message);
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
