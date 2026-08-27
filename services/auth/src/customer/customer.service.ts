import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BookingStatus } from '@learn-and-build/types';
import { ChildProfile } from './entities/child-profile.entity';
import { SavedClass } from './entities/saved-class.entity';
import { Booking } from './entities/booking.entity';
import { CustomerNotification } from './entities/customer-notification.entity';

const AVATAR_COLORS = ['#7c5cff', '#f0871f', '#2fb37f', '#d1477a', '#3f7ad1'];

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(ChildProfile)
    private readonly children: Repository<ChildProfile>,
    @InjectRepository(SavedClass)
    private readonly saved: Repository<SavedClass>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(CustomerNotification)
    private readonly notifications: Repository<CustomerNotification>,
  ) {}

  // --- Children ---
  listChildren(userId: string): Promise<ChildProfile[]> {
    return this.children.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  createChild(
    userId: string,
    input: { name: string; birthDate?: string; interests?: string[]; avatarColor?: string },
    index = 0,
  ): Promise<ChildProfile> {
    const child = this.children.create({
      userId,
      name: input.name,
      birthDate: input.birthDate ?? null,
      interests: input.interests ?? [],
      avatarColor: input.avatarColor ?? AVATAR_COLORS[index % AVATAR_COLORS.length],
    });
    return this.children.save(child);
  }

  async updateChild(
    userId: string,
    id: string,
    input: { name?: string; birthDate?: string; interests?: string[]; avatarColor?: string },
  ): Promise<ChildProfile> {
    const child = await this.children.findOne({ where: { id, userId } });
    if (!child) throw new NotFoundException('Child profile not found');
    if (input.name !== undefined) child.name = input.name;
    if (input.birthDate !== undefined) child.birthDate = input.birthDate || null;
    if (input.interests !== undefined) child.interests = input.interests;
    if (input.avatarColor !== undefined) child.avatarColor = input.avatarColor;
    return this.children.save(child);
  }

  // --- Saved classes ---
  listSaved(userId: string): Promise<SavedClass[]> {
    return this.saved.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async saveClass(
    userId: string,
    classRef: string,
    title: string,
  ): Promise<SavedClass> {
    const existing = await this.saved.findOne({ where: { userId, classRef } });
    if (existing) {
      existing.title = title || existing.title;
      return this.saved.save(existing);
    }
    return this.saved.save(
      this.saved.create({ userId, classRef, title: title || classRef }),
    );
  }

  async removeSaved(userId: string, classRef: string): Promise<void> {
    await this.saved.delete({ userId, classRef });
  }

  // --- Bookings ---
  listBookings(userId: string): Promise<Booking[]> {
    return this.bookings.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createBooking(
    userId: string,
    input: {
      classRef: string;
      classSlug?: string;
      reservationId?: string;
      title: string;
      scheduledStart: string;
      amountMinor?: number;
      currency?: string;
    },
  ): Promise<Booking> {
    const booking = await this.bookings.save(
      this.bookings.create({
        userId,
        classRef: input.classRef,
        classSlug: input.classSlug ?? null,
        reservationId: input.reservationId ?? null,
        title: input.title,
        scheduledStart: new Date(input.scheduledStart),
        amountMinor: input.amountMinor ?? 0,
        currency: input.currency ?? 'INR',
        status: BookingStatus.CONFIRMED,
      }),
    );
    await this.notify(userId, 'booking', 'Booking confirmed', `You're booked for ${input.title}.`);
    return booking;
  }

  async cancelBooking(userId: string, id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    booking.status = BookingStatus.CANCELLED;
    return this.bookings.save(booking);
  }

  // --- Notifications ---
  listNotifications(
    userId: string,
    unreadOnly = false,
  ): Promise<CustomerNotification[]> {
    return this.notifications.find({
      where: unreadOnly ? { userId, readAt: IsNull() } : { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async notify(
    userId: string,
    kind: string,
    title: string,
    body: string,
  ): Promise<CustomerNotification> {
    return this.notifications.save(
      this.notifications.create({ userId, kind, title, body, readAt: null }),
    );
  }

  async markNotificationRead(
    userId: string,
    id: string,
  ): Promise<CustomerNotification> {
    const n = await this.notifications.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.readAt = n.readAt ?? new Date();
    return this.notifications.save(n);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}
