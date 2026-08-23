import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type AuthPrincipal } from '@learn-and-build/nest-auth';
import type { BookingDto, ChildProfileDto, CustomerNotificationDto, SavedClassDto } from '@learn-and-build/types';
import { CustomerService } from './customer.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateChildDto } from './dto/create-child.dto';
import { SaveClassDto } from './dto/save-class.dto';
import { UpdateChildDto } from './dto/update-child.dto';

@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(private readonly customer: CustomerService) {}

  @Get('children')
  async children(@CurrentUser() user: AuthPrincipal): Promise<ChildProfileDto[]> {
    return (await this.customer.listChildren(user.sub)).map((item) => item.toDto());
  }

  @Post('children')
  async createChild(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateChildDto): Promise<ChildProfileDto> {
    return (await this.customer.createChild(user.sub, dto)).toDto();
  }

  @Patch('children/:id')
  async updateChild(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateChildDto): Promise<ChildProfileDto> {
    return (await this.customer.updateChild(user.sub, id, dto)).toDto();
  }

  @Get('saved-classes')
  async savedClasses(@CurrentUser() user: AuthPrincipal): Promise<SavedClassDto[]> {
    return (await this.customer.listSavedClasses(user.sub)).map((item) => item.toDto());
  }

  @Put('saved-classes/:classRef')
  async saveClass(@CurrentUser() user: AuthPrincipal, @Param('classRef') classRef: string, @Body() dto: SaveClassDto): Promise<SavedClassDto> {
    return (await this.customer.saveClass(user.sub, classRef, dto.title)).toDto();
  }

  @Delete('saved-classes/:classRef')
  @HttpCode(204)
  removeSavedClass(@CurrentUser() user: AuthPrincipal, @Param('classRef') classRef: string): Promise<void> {
    return this.customer.removeSavedClass(user.sub, classRef);
  }

  @Get('bookings')
  async bookings(@CurrentUser() user: AuthPrincipal): Promise<BookingDto[]> {
    return (await this.customer.listBookings(user.sub)).map((item) => item.toDto());
  }

  @Post('bookings')
  async createBooking(@CurrentUser() user: AuthPrincipal, @Headers('authorization') authorization: string, @Body() dto: CreateBookingDto): Promise<BookingDto> {
    return (await this.customer.createBooking(user.sub, authorization, dto)).toDto();
  }

  @Patch('bookings/:id/cancel')
  async cancelBooking(@CurrentUser() user: AuthPrincipal, @Headers('authorization') authorization: string, @Param('id') id: string): Promise<BookingDto> {
    return (await this.customer.cancelBooking(user.sub, authorization, id)).toDto();
  }

  @Get('notifications')
  async notifications(@CurrentUser() user: AuthPrincipal, @Query('unreadOnly') unreadOnly?: string): Promise<CustomerNotificationDto[]> {
    return (await this.customer.listNotifications(user.sub, unreadOnly === 'true')).map((item) => item.toDto());
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  readAllNotifications(@CurrentUser() user: AuthPrincipal): Promise<void> {
    return this.customer.readAllNotifications(user.sub);
  }

  @Patch('notifications/:id/read')
  async readNotification(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<CustomerNotificationDto> {
    return (await this.customer.readNotification(user.sub, id)).toDto();
  }
}
