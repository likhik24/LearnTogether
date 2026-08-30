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
  SavedClassDto,
} from '@learn-and-build/types';
import { CustomerService } from './customer.service';
import { CreateBookingDto, CreateChildDto, SaveClassDto, UpdateChildDto } from './customer.dto';
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
    return (await this.customer.saveClass(u.sub, downstreamAuthorization(request), classRef)).toDto();
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
    return (await this.customer.createBooking(u.sub, downstreamAuthorization(request), dto)).toDto();
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
