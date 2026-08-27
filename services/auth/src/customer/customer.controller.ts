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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, type AuthPrincipal } from '@learn-and-build/nest-auth';
import type {
  BookingDto,
  ChildProfileDto,
  CustomerNotificationDto,
  SavedClassDto,
} from '@learn-and-build/types';
import { CustomerService } from './customer.service';
import {
  CreateBookingDto,
  CreateChildDto,
  SaveClassDto,
  UpdateChildDto,
} from './customer.dto';

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
    @Param('classRef') classRef: string,
    @Body() dto: SaveClassDto,
  ): Promise<SavedClassDto> {
    return (await this.customer.saveClass(u.sub, classRef, dto.title ?? '')).toDto();
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
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDto> {
    return (await this.customer.createBooking(u.sub, dto)).toDto();
  }

  @Patch('bookings/:id/cancel')
  async cancelBooking(
    @CurrentUser() u: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<BookingDto> {
    return (await this.customer.cancelBooking(u.sub, id)).toDto();
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
