import { NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@learn-and-build/types';
import type { ObjectLiteral, Repository } from 'typeorm';
import { CustomerService } from './customer.service';
import { Booking } from './entities/booking.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SavedClass } from './entities/saved-class.entity';

type Repo<T extends ObjectLiteral> = jest.Mocked<Pick<Repository<T>, 'create' | 'save' | 'find' | 'findOne' | 'delete' | 'update'>>;

function repository<T extends ObjectLiteral>(): Repo<T> {
  return { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn(), update: jest.fn() } as unknown as Repo<T>;
}

describe('CustomerService', () => {
  let children: Repo<ChildProfile>;
  let saved: Repo<SavedClass>;
  let bookings: Repo<Booking>;
  let notifications: Repo<CustomerNotification>;
  let service: CustomerService;

  beforeEach(() => {
    children = repository();
    saved = repository();
    bookings = repository();
    notifications = repository();
    service = new CustomerService(
      children as unknown as Repository<ChildProfile>,
      saved as unknown as Repository<SavedClass>,
      bookings as unknown as Repository<Booking>,
      notifications as unknown as Repository<CustomerNotification>,
    );
  });

  it('creates an owned child profile and a welcome notification', async () => {
    const child = Object.assign(new ChildProfile(), { id: 'child-1', userId: 'user-1', name: 'Abhiram' });
    children.create.mockReturnValue(child);
    children.save.mockResolvedValue(child);
    notifications.create.mockImplementation((value) => value as CustomerNotification);
    notifications.save.mockImplementation(async (value) => value as CustomerNotification);

    const result = await service.createChild('user-1', { name: 'Abhiram', interests: ['STEM'] });

    expect(result).toBe(child);
    expect(children.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', interests: ['STEM'] }));
    expect(notifications.save).toHaveBeenCalledTimes(1);
  });

  it('saves a class idempotently for a user', async () => {
    const existing = Object.assign(new SavedClass(), { id: 'saved-1', userId: 'user-1', classRef: 'build-a-car' });
    saved.findOne.mockResolvedValue(existing);

    await expect(service.saveClass('user-1', 'build-a-car', 'Build a Car')).resolves.toBe(existing);
    expect(saved.save).not.toHaveBeenCalled();
  });

  it('does not update a child belonging to another user', async () => {
    children.findOne.mockResolvedValue(null);
    await expect(service.updateChild('user-1', 'child-2', { name: 'Nope' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates and cancels a booking', async () => {
    const booking = Object.assign(new Booking(), { id: 'booking-1', userId: 'user-1', status: BookingStatus.CONFIRMED });
    bookings.create.mockReturnValue(booking);
    bookings.save.mockResolvedValue(booking);
    notifications.create.mockImplementation((value) => value as CustomerNotification);
    notifications.save.mockImplementation(async (value) => value as CustomerNotification);

    await service.createBooking('user-1', { classRef: 'build-a-car', title: 'Build a Car', scheduledStart: '2026-08-29T05:00:00.000Z', amountMinor: 49900, currency: 'INR' });
    bookings.findOne.mockResolvedValue(booking);
    await service.cancelBooking('user-1', 'booking-1');

    expect(booking.status).toBe(BookingStatus.CANCELLED);
    expect(notifications.save).toHaveBeenCalledTimes(2);
  });

  it('marks all unread notifications as read', async () => {
    notifications.update.mockResolvedValue({ affected: 2, generatedMaps: [], raw: [] });
    await service.readAllNotifications('user-1');
    expect(notifications.update).toHaveBeenCalledTimes(1);
  });
});
