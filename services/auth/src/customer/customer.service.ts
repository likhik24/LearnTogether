import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BookingStatus } from '@learn-and-build/types';
import { ChildProfile } from './entities/child-profile.entity';
import { SavedClass } from './entities/saved-class.entity';
import { Booking } from './entities/booking.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SchedulingGateway } from './scheduling.gateway';

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
    private readonly scheduling: SchedulingGateway,
  ) {}

  // --- Children ---
  listChildren(userId: string): Promise<ChildProfile[]> {
    return this.children.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async createChild(
    userId: string,
    input: { name: string; birthDate?: string; interests?: string[]; avatarColor?: string },
    index = 0,
  ): Promise<ChildProfile> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Child name is required');
    assertValidBirthDate(input.birthDate);
    const child = this.children.create({
      userId,
      name,
      birthDate: input.birthDate ?? null,
      interests: input.interests ?? [],
      avatarColor: input.avatarColor ?? AVATAR_COLORS[index % AVATAR_COLORS.length],
    });
    const savedChild = await this.children.save(child);
    await this.notify(
      userId,
      'profile',
      `${savedChild.name}'s profile is ready`,
      'Recommendations will improve as you add interests and save classes.',
    );
    return savedChild;
  }

  async updateChild(
    userId: string,
    id: string,
    input: { name?: string; birthDate?: string; interests?: string[]; avatarColor?: string },
  ): Promise<ChildProfile> {
    const child = await this.children.findOne({ where: { id, userId } });
    if (!child) throw new NotFoundException('Child profile not found');
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Child name is required');
      child.name = name;
    }
    if (input.birthDate !== undefined) {
      assertValidBirthDate(input.birthDate);
      child.birthDate = input.birthDate || null;
    }
    if (input.interests !== undefined) child.interests = input.interests;
    if (input.avatarColor !== undefined) child.avatarColor = input.avatarColor;
    return this.children.save(child);
  }

  // --- Saved classes ---
  listSaved(userId: string): Promise<SavedClass[]> {
    return this.saved.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async saveClass(userId: string, authorization: string, classRef: string): Promise<SavedClass> {
    const existing = await this.saved.findOne({ where: { userId, classRef } });
    if (existing) return existing;
    const offering = await this.scheduling.getClass(authorization, classRef);
    return this.saved.save(this.saved.create({ userId, classRef, title: offering.activity }));
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
    authorization: string,
    input: {
      childId: string;
      classRef: string;
      classSlug?: string;
      reservationId?: string;
      title: string;
      scheduledStart: string;
      amountMinor?: number;
      currency?: string;
    },
  ): Promise<Booking> {
    const child = await this.children.findOne({ where: { id: input.childId, userId } });
    if (!child)
      throw new BadRequestException('Select a child profile that belongs to your account');
    if (!child.birthDate)
      throw new BadRequestException('Add the selected child’s birthday before booking');

    // Class identity, title and price are authoritative Scheduling data. Never
    // trust a browser-provided snapshot for a booking record.
    const offering = await this.scheduling.getClass(authorization, input.classRef);
    const scheduledStart = new Date(input.scheduledStart);
    const childAge = ageOnDate(child.birthDate, scheduledStart);
    if (childAge < offering.ageMin || childAge > offering.ageMax) {
      throw new BadRequestException(
        `${child.name} is ${childAge} on this date; this class is for ages ${offering.ageMin}–${offering.ageMax}`,
      );
    }
    const existing = await this.bookings.findOne({
      where: {
        userId,
        classRef: offering.id,
        scheduledStart,
        status: BookingStatus.CONFIRMED,
      },
    });
    if (existing) {
      if (existing.childId === child.id) return existing;
      throw new BadRequestException(
        'This account already reserved this class time for another child',
      );
    }

    const reservation = await this.scheduling.reserve(
      authorization,
      offering.id,
      input.scheduledStart,
    );
    let booking: Booking;
    try {
      booking = await this.bookings.save(
        this.bookings.create({
          userId,
          classRef: offering.id,
          classSlug: offering.slug ?? input.classSlug ?? null,
          reservationId: reservation.id,
          childId: child.id,
          childName: child.name,
          title: offering.activity,
          scheduledStart,
          amountMinor: offering.priceMinor,
          currency: offering.currency,
          status: BookingStatus.CONFIRMED,
        }),
      );
    } catch (error) {
      await this.scheduling
        .release(authorization, offering.id, reservation.id)
        .catch(() => undefined);
      throw error;
    }
    await this.notify(
      userId,
      'booking',
      `${booking.title} confirmed`,
      'Your trial-class spot is ready. You can review or cancel it from Bookings.',
    );
    return booking;
  }

  async cancelBooking(userId: string, authorization: string, id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) return booking;
    if (booking.reservationId) {
      await this.scheduling.release(authorization, booking.classRef, booking.reservationId);
    }
    booking.status = BookingStatus.CANCELLED;
    const cancelled = await this.bookings.save(booking);
    await this.notify(
      userId,
      'booking',
      `${booking.title} cancelled`,
      'The trial booking has been removed from your upcoming plans.',
    );
    return cancelled;
  }

  // --- Notifications ---
  listNotifications(userId: string, unreadOnly = false): Promise<CustomerNotification[]> {
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

  async markNotificationRead(userId: string, id: string): Promise<CustomerNotification> {
    const n = await this.notifications.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.readAt = n.readAt ?? new Date();
    return this.notifications.save(n);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }
}

function assertValidBirthDate(value?: string): void {
  if (!value) return;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Birthday is invalid');
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (date > today) throw new BadRequestException('Birthday cannot be in the future');
}

function ageOnDate(birthDate: string, occurrence: Date): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = occurrence.getUTCFullYear() - year;
  const occurrenceMonth = occurrence.getUTCMonth() + 1;
  const occurrenceDay = occurrence.getUTCDate();
  if (occurrenceMonth < month || (occurrenceMonth === month && occurrenceDay < day)) age -= 1;
  return age;
}
