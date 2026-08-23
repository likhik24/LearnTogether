import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BookingStatus } from '@learn-and-build/types';
import { Booking } from './entities/booking.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SavedClass } from './entities/saved-class.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { SchedulingGateway } from './scheduling.gateway';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(ChildProfile) private readonly children: Repository<ChildProfile>,
    @InjectRepository(SavedClass) private readonly saved: Repository<SavedClass>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(CustomerNotification) private readonly notifications: Repository<CustomerNotification>,
    private readonly scheduling: SchedulingGateway,
  ) {}

  listChildren(userId: string): Promise<ChildProfile[]> {
    return this.children.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async createChild(userId: string, dto: CreateChildDto): Promise<ChildProfile> {
    const child = await this.children.save(this.children.create({
      userId,
      name: dto.name,
      birthDate: dto.birthDate ?? null,
      interests: dto.interests ?? [],
      avatarColor: dto.avatarColor ?? '#f5c976',
    }));
    await this.notifications.save(this.notifications.create({
      userId,
      kind: 'profile',
      title: `${child.name}'s profile is ready`,
      body: 'Recommendations will improve as you add interests and save classes.',
      readAt: null,
    }));
    return child;
  }

  async updateChild(userId: string, id: string, dto: UpdateChildDto): Promise<ChildProfile> {
    const child = await this.children.findOne({ where: { id, userId } });
    if (!child) throw new NotFoundException(`Child profile ${id} not found`);
    Object.assign(child, dto);
    return this.children.save(child);
  }

  listSavedClasses(userId: string): Promise<SavedClass[]> {
    return this.saved.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async saveClass(userId: string, classRef: string, title: string): Promise<SavedClass> {
    const existing = await this.saved.findOne({ where: { userId, classRef } });
    if (existing) return existing;
    return this.saved.save(this.saved.create({ userId, classRef, title }));
  }

  async removeSavedClass(userId: string, classRef: string): Promise<void> {
    await this.saved.delete({ userId, classRef });
  }

  listBookings(userId: string): Promise<Booking[]> {
    return this.bookings.find({ where: { userId }, order: { scheduledStart: 'ASC' } });
  }

  async createBooking(userId: string, authorization: string, dto: CreateBookingDto): Promise<Booking> {
    const scheduledStart = new Date(dto.scheduledStart);
    const existing = await this.bookings.findOne({ where: { userId, classRef: dto.classRef, scheduledStart, status: BookingStatus.CONFIRMED } });
    if (existing) return existing;
    const reservation = await this.scheduling.reserve(authorization, dto.classRef, dto.scheduledStart);
    let booking: Booking;
    try {
      booking = await this.bookings.save(this.bookings.create({
        userId,
        classRef: dto.classRef,
        classSlug: dto.classSlug ?? null,
        reservationId: reservation.id,
        title: dto.title,
        scheduledStart,
        amountMinor: dto.amountMinor,
        currency: dto.currency,
        status: BookingStatus.CONFIRMED,
      }));
    } catch (error) {
      await this.scheduling.release(authorization, dto.classRef, reservation.id).catch(() => undefined);
      throw error;
    }
    await this.notifications.save(this.notifications.create({
      userId,
      kind: 'booking',
      title: `${booking.title} confirmed`,
      body: 'Your trial-class spot is ready. You can review or cancel it from Bookings.',
      readAt: null,
    }));
    return booking;
  }

  async cancelBooking(userId: string, authorization: string, id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id, userId } });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    if (booking.status === BookingStatus.CANCELLED) return booking;
    if (booking.reservationId) await this.scheduling.release(authorization, booking.classRef, booking.reservationId);
    booking.status = BookingStatus.CANCELLED;
    const cancelled = await this.bookings.save(booking);
    await this.notifications.save(this.notifications.create({
      userId,
      kind: 'booking',
      title: `${booking.title} cancelled`,
      body: 'The trial booking has been removed from your upcoming plans.',
      readAt: null,
    }));
    return cancelled;
  }

  listNotifications(userId: string, unreadOnly = false): Promise<CustomerNotification[]> {
    return this.notifications.find({
      where: { userId, ...(unreadOnly ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async readNotification(userId: string, id: string): Promise<CustomerNotification> {
    const notification = await this.notifications.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    notification.readAt = notification.readAt ?? new Date();
    return this.notifications.save(notification);
  }

  async readAllNotifications(userId: string): Promise<void> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }
}
