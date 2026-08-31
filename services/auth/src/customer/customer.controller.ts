import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, CurrentUser, type AuthPrincipal } from '@learn-and-build/nest-auth';
import type {
  BookingDto,
  ChildProfileDto,
  CustomerNotificationDto,
  ClassWaitlistDto,
  BookingRescheduleRequestDto,
  SavedClassDto,
} from '@learn-and-build/types';
import { CustomerService } from './customer.service';
import {
  CreateBookingDto,
  CreateChildDto,
  JoinWaitlistDto,
  RequestBookingRescheduleDto,
  SaveClassDto,
  UpdateChildDto,
} from './customer.dto';
import { ACCESS_COOKIE, readCookie } from '../auth/session-cookies';

/** Per-user customer data (children, saved classes, bookings, notifications). */
@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(private readonly customer: CustomerService) {}

  @Get('children')
  async listChildren(@CurrentUser() u: AuthPrincipal): Promise<ChildProfileDto[]> {
    return (await this.customer.listChildren(u.sub)).map((c) => c.toDto());
  }

  @Post('children')
  async createChild(
    @CurrentUser() u: AuthPrincipal,
    @Body() dto: CreateChildDto,
  ): Promise<ChildProfileDto> {
    const count = (await this.customer.listChildren(u.sub)).length;
    return (await this.customer.createChild(u.sub, dto, count)).toDto();
  }

  @Patch('children/:id')
  async updateChild(
    @CurrentUser() u: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateChildDto,
  ): Promise<ChildProfileDto> {
    return (await this.customer.updateChild(u.sub, id, dto)).toDto();
  }

  @Get('saved-classes')
  async listSaved(@CurrentUser() u: AuthPrincipal): Promise<SavedClassDto[]> {
    return (await this.customer.listSaved(u.sub)).map((s) => s.toDto());
  }

  @Put('saved-classes/:classRef')
  async saveClass(
    @CurrentUser() u: AuthPrincipal,
    @Req() request: Request,
    @Param('classRef') classRef: string,
    @Body() _dto: SaveClassDto,
  ): Promise<SavedClassDto> {
    return (
      await this.customer.saveClass(u.sub, downstreamAuthorization(request), classRef)
    ).toDto();
  }

  @Delete('saved-classes/:classRef')
  @HttpCode(204)
  async removeSaved(
    @CurrentUser() u: AuthPrincipal,
    @Param('classRef') classRef: string,
  ): Promise<void> {
    await this.customer.removeSaved(u.sub, classRef);
  }

  @Get('bookings')
  async listBookings(@CurrentUser() u: AuthPrincipal): Promise<BookingDto[]> {
    return (await this.customer.listBookings(u.sub)).map((b) => b.toDto());
  }

  @Post('bookings')
  async createBooking(
    @CurrentUser() u: AuthPrincipal,
    @Req() request: Request,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDto> {
    return (
      await this.customer.createBooking(u.sub, downstreamAuthorization(request), dto)
    ).toDto();
  }

  @Patch('bookings/:id/cancel')
  async cancelBooking(
    @CurrentUser() u: AuthPrincipal,
    @Req() request: Request,
    @Param('id') id: string,
  ): Promise<BookingDto> {
    return (await this.customer.cancelBooking(u.sub, downstreamAuthorization(request), id)).toDto();
  }

  @Get('notifications')
  async listNotifications(
    @CurrentUser() u: AuthPrincipal,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<CustomerNotificationDto[]> {
    const list = await this.customer.listNotifications(u.sub, unreadOnly === 'true');
    return list.map((n) => n.toDto());
  }

  @Patch('notifications/:id/read')
  async markRead(
    @CurrentUser() u: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<CustomerNotificationDto> {
    return (await this.customer.markNotificationRead(u.sub, id)).toDto();
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  async markAllRead(@CurrentUser() u: AuthPrincipal): Promise<void> {
    await this.customer.markAllNotificationsRead(u.sub);
  }

  @Get('waitlist')
  async waitlist(@CurrentUser() user: AuthPrincipal): Promise<ClassWaitlistDto[]> {
    return (await this.customer.listWaitlist(user.sub)).map(({ entry, position }) =>
      entry.toDto(position),
    );
  }

  @Post('waitlist')
  async joinWaitlist(
    @CurrentUser() user: AuthPrincipal,
    @Req() request: Request,
    @Body() input: JoinWaitlistDto,
  ): Promise<ClassWaitlistDto> {
    const { entry, position } = await this.customer.joinWaitlist(
      user.sub,
      downstreamAuthorization(request),
      input,
    );
    return entry.toDto(position);
  }

  @Delete('waitlist/:id')
  async leaveWaitlist(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<ClassWaitlistDto> {
    return (await this.customer.leaveWaitlist(user.sub, id)).toDto();
  }

  @Get('reschedule-requests')
  async rescheduleRequests(
    @CurrentUser() user: AuthPrincipal,
  ): Promise<BookingRescheduleRequestDto[]> {
    return (await this.customer.listRescheduleRequests(user.sub)).map((item) => item.toDto());
  }

  @Post('bookings/:id/reschedule-request')
  async requestReschedule(
    @CurrentUser() user: AuthPrincipal,
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: RequestBookingRescheduleDto,
  ): Promise<BookingRescheduleRequestDto> {
    return (
      await this.customer.requestReschedule(user.sub, downstreamAuthorization(request), id, input)
    ).toDto();
  }

  @Get('data-export')
  dataExport(@CurrentUser() user: AuthPrincipal): Promise<Record<string, unknown>> {
    return this.customer.exportData(user.sub);
  }

  @Delete('account')
  requestAccountDeletion(@CurrentUser() user: AuthPrincipal) {
    return this.customer.requestAccountDeletion(user.sub);
  }

  @Get('account/deletion')
  accountDeletionStatus(@CurrentUser() user: AuthPrincipal) {
    return this.customer.accountDeletionStatus(user.sub);
  }

  @Post('account/deletion/cancel')
  @HttpCode(204)
  cancelAccountDeletion(@CurrentUser() user: AuthPrincipal): Promise<void> {
    return this.customer.cancelAccountDeletion(user.sub);
  }
}

/** Forward the already-validated user identity to Scheduling. Browser clients
 * authenticate with an HttpOnly cookie, so an Authorization header is often
 * intentionally absent at this boundary. */
export function downstreamAuthorization(request: Request): string {
  const header = request.headers.authorization;
  if (header) return header;
  const token = readCookie(request, ACCESS_COOKIE);
  return token ? `Bearer ${token}` : '';
}
